import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MENU } from "../shared/menu";
import { createOrder, getOrderByCode, getOrderStats, listOrders, listOrdersByPeriod, updateOrderStatus } from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0),
  observation: z.string().max(240).optional().default(""),
});

const orderStatusSchema = z.enum(["received", "preparing", "ready", "completed", "cancelled"]);

function makeOrderCode() {
  return `MC-${Date.now().toString(36).slice(-5).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  menu: router({
    list: publicProcedure.query(() => MENU),
  }),
  orders: router({
    create: publicProcedure
      .input(z.object({
        origin: z.string().min(1).max(64),
        serviceMode: z.enum(["customer", "waiter", "counter"]),
        tableName: z.string().max(64).optional(),
        customerName: z.string().max(120).optional(),
        paymentMethod: z.string().min(1).max(64),
        notes: z.string().max(600).optional(),
        items: z.array(orderItemSchema).min(1).max(40),
      }))
      .mutation(async ({ input }) => {
        const menuById = new Map(MENU.map(item => [item.id, item]));
        const normalizedItems = input.items.map(item => {
          const catalogItem = menuById.get(item.productId);
          if (!catalogItem) throw new TRPCError({ code: "BAD_REQUEST", message: `Produto não encontrado: ${item.name}` });
          return {
            productId: catalogItem.id,
            name: catalogItem.name,
            category: catalogItem.category,
            quantity: item.quantity,
            unitPriceCents: catalogItem.priceCents,
            observation: item.observation ?? "",
          };
        });
        const totalCents = normalizedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
        const order = await createOrder({
          code: makeOrderCode(),
          origin: input.origin,
          serviceMode: input.serviceMode,
          tableName: input.tableName?.trim() || null,
          customerName: input.customerName?.trim() || null,
          paymentMethod: input.paymentMethod,
          notes: input.notes?.trim() || null,
          items: normalizedItems,
          totalCents,
          status: "received",
        });
        return { order, menu: MENU };
      }),
    get: publicProcedure.input(z.object({ code: z.string().min(1) })).query(async ({ input }) => {
      const order = await getOrderByCode(input.code);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
      return order;
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
      return listOrders();
    }),
    setStatus: protectedProcedure
      .input(z.object({ code: z.string().min(1), status: orderStatusSchema }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        const order = await updateOrderStatus(input.code, input.status);
        if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
        return order;
      }),
    stats: protectedProcedure
      .input(z.object({ period: z.enum(["day", "week", "month", "year"]).default("day") }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        return getOrderStats(input.period);
      }),
    listByPeriod: protectedProcedure
      .input(z.object({ start: z.string(), end: z.string() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        return listOrdersByPeriod(new Date(input.start), new Date(input.end));
      }),
  }),
});

export type AppRouter = typeof appRouter;

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MENU } from "../shared/menu";
import {
  addCashMovement,
  addPayment,
  cancelOrder,
  closeCashRegister,
  createOrder,
  getActiveCashRegister,
  getCashRegisterSummary,
  getOrderByCode,
  getOrderStats,
  getPaymentsForOrder,
  getStoreSetting,
  listAuditLogs,
  listCashMovements,
  listCashRegisters,
  listOrders,
  listOrdersByPeriod,
  openCashRegister,
  refundPayment,
  setStoreSetting,
  updateOrderStatus,
} from "./db";
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
const paymentMethodSchema = z.enum(["pix", "credito", "debito", "dinheiro", "vale_refeicao"]);

function makeOrderCode() {
  return `MC-${Date.now().toString(36).slice(-5).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  menu: router({
    list: publicProcedure.query(() => MENU),
  }),
  settings: router({
    getPaymentMethods: publicProcedure.query(async () => {
      return getStoreSetting<string[]>("active_payment_methods", [
        "Pix",
        "Cartão Crédito",
        "Cartão Débito",
        "Dinheiro",
        "Vale Refeição",
      ]);
    }),
    setPaymentMethods: protectedProcedure
      .input(z.object({ methods: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à equipe." });
        await setStoreSetting("active_payment_methods", input.methods);
        return { success: true, methods: input.methods };
      }),
  }),
  orders: router({
    create: publicProcedure
      .input(
        z.object({
          origin: z.string().min(1).max(64),
          serviceMode: z.enum(["customer", "waiter", "counter"]),
          tableName: z.string().max(64).optional(),
          customerName: z.string().max(120).optional(),
          paymentMethod: z.string().min(1).max(64),
          notes: z.string().max(600).optional(),
          items: z.array(orderItemSchema).min(1).max(40),
        })
      )
      .mutation(async ({ input }) => {
        const menuById = new Map(MENU.map((item) => [item.id, item]));
        const normalizedItems = input.items.map((item) => {
          const catalogItem = menuById.get(item.productId);
          if (!catalogItem) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Produto não encontrado: ${item.name}` });
          }
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
          financialStatus: "pending",
          paidCents: 0,
        });
        return { order, menu: MENU };
      }),
    get: publicProcedure.input(z.object({ code: z.string().min(1) })).query(async ({ input }) => {
      const order = await getOrderByCode(input.code);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
      const payments = await getPaymentsForOrder(order.code);
      return { ...order, payments };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
      return listOrders();
    }),
    setStatus: protectedProcedure
      .input(z.object({ code: z.string().min(1), status: orderStatusSchema }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        const existing = await getOrderByCode(input.code);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });

        // Regra de validação: Bloquear a finalização/entrega do pedido de balcão sem pagamento (exceto mesa aberta)
        if (input.status === "completed" && existing.serviceMode === "counter" && existing.financialStatus !== "paid") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pedidos de balcão precisam estar com o pagamento concluído antes de serem finalizados/entregues.",
          });
        }

        const order = await updateOrderStatus(input.code, input.status);
        return order;
      }),
    cancel: protectedProcedure
      .input(z.object({ code: z.string().min(1), reason: z.string().min(3, "Informe o motivo do cancelamento") }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à gerência." });
        const operator = ctx.user?.name || "Gerente";
        const order = await cancelOrder(input.code, input.reason, operator);
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
  payments: router({
    create: protectedProcedure
      .input(
        z.object({
          orderCode: z.string().min(1),
          items: z
            .array(
              z.object({
                method: paymentMethodSchema,
                amountCents: z.number().int().positive("Valor do pagamento deve ser positivo"),
                receivedCents: z.number().int().optional(),
                changeCents: z.number().int().optional(),
                cardBrand: z.string().max(64).optional(),
                receiptRef: z.string().max(120).optional(),
              })
            )
            .min(1, "Adicione ao menos uma forma de pagamento"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        const operator = ctx.user?.name || "Atendente";

        // Check if any payment is in cash, verify active cash register
        const hasCash = input.items.some((i) => i.method === "dinheiro");
        const activeRegister = await getActiveCashRegister();
        if (hasCash && !activeRegister) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Não é possível receber em dinheiro sem um caixa aberto. Abra o caixa antes de continuar.",
          });
        }

        const results = [];
        let updatedOrder = null;
        for (const item of input.items) {
          const res = await addPayment({
            orderCode: input.orderCode,
            method: item.method,
            amountCents: item.amountCents,
            receivedCents: item.receivedCents,
            changeCents: item.changeCents,
            cardBrand: item.cardBrand,
            receiptRef: item.receiptRef,
            cashRegisterId: activeRegister ? activeRegister.id : undefined,
            operatorName: operator,
          });
          results.push(res.payment);
          updatedOrder = res.order;
        }

        return { payments: results, order: updatedOrder };
      }),
    refund: protectedProcedure
      .input(z.object({ paymentId: z.number().int(), reason: z.string().min(3, "Informe o motivo do estorno") }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à gerência." });
        const user = ctx.user?.name || "Gerente";
        return refundPayment(input.paymentId, input.reason, user);
      }),
    listForOrder: protectedProcedure
      .input(z.object({ orderCode: z.string().min(1) }))
      .query(async ({ input }) => {
        return getPaymentsForOrder(input.orderCode);
      }),
  }),
  cash: router({
    getActive: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
      const active = await getActiveCashRegister();
      if (!active) return null;
      return getCashRegisterSummary(active.id);
    }),
    open: protectedProcedure
      .input(
        z.object({
          initialAmountCents: z.number().int().min(0, "Fundo de troco não pode ser negativo"),
          operatorName: z.string().min(1).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        const operator = input.operatorName || ctx.user?.name || "Operador";
        const register = await openCashRegister(operator, input.initialAmountCents);
        return register;
      }),
    movement: protectedProcedure
      .input(
        z.object({
          type: z.enum(["bleed", "supply", "expense"]),
          amountCents: z.number().int().positive("Valor deve ser maior que zero"),
          reason: z.string().min(3, "Justificativa obrigatória"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        const active = await getActiveCashRegister();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não há nenhum caixa aberto no momento." });
        }
        const responsible = ctx.user?.name || "Operador";
        const movement = await addCashMovement({
          cashRegisterId: active.id,
          type: input.type,
          amountCents: input.amountCents,
          reason: input.reason,
          responsible,
        });
        return movement;
      }),
    close: protectedProcedure
      .input(
        z.object({
          countedCashCents: z.number().int().min(0, "Valor contado não pode ser negativo"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à gerência." });
        const active = await getActiveCashRegister();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não há nenhum caixa aberto para fechar." });
        }
        const operator = ctx.user?.name || "Gerente";
        const closed = await closeCashRegister({
          cashRegisterId: active.id,
          countedCashCents: input.countedCashCents,
          notes: input.notes,
          operatorName: operator,
        });
        const summary = await getCashRegisterSummary(active.id);
        return { register: closed, summary };
      }),
    listRegisters: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
      return listCashRegisters(30);
    }),
    listMovements: protectedProcedure
      .input(z.object({ cashRegisterId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        return listCashMovements(input.cashRegisterId);
      }),
    getSummary: protectedProcedure
      .input(z.object({ cashRegisterId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        return getCashRegisterSummary(input.cashRegisterId);
      }),
  }),
  audit: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à gerência/dono." });
      return listAuditLogs(100);
    }),
  }),
});

export type AppRouter = typeof appRouter;

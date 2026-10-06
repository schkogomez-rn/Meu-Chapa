import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router, staffProcedure, staffRoleProcedure } from "./_core/trpc";
import {
  closeTableSession,
  createOrGetTableSession,
  getTableSessionByToken,
  listAllTableSessions,
  recordAudit,
  recordTableOrder,
  regenerateTableToken,
} from "./staffDb";
import { createOrder, getOrderByCode } from "./db";
import { MENU } from "../shared/menu";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0),
  observation: z.string().max(240).optional().default(""),
});

function makeOrderCode() {
  return `MC-${Date.now().toString(36).slice(-5).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export const qrSessionRouter = router({
  // ─── Validate or Register Customer Table Session (/m/:token) ───────────────
  validateSession: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(128),
        customerName: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const session = await getTableSessionByToken(input.token);

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Este QR Code é inválido ou já foi encerrado. Por favor, solicite um novo ao garçom.",
        });
      }

      if (session.status !== "active" || new Date(session.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta sessão de mesa expirou. Escaneie novamente ou solicite ao garçom.",
        });
      }

      return {
        valid: true,
        tableName: session.tableName,
        customerName: session.customerName || input.customerName || null,
        expiresAt: session.expiresAt,
        token: session.token,
      };
    }),

  // ─── Create Customer Order via QR Session ──────────────────────────────────
  createCustomerOrder: publicProcedure
    .input(
      z.object({
        token: z.string().min(10).max(128),
        customerName: z.string().max(120).optional(),
        tableName: z.string().max(64).optional(),
        paymentMethod: z.string().default("pix"),
        notes: z.string().max(600).optional(),
        items: z.array(orderItemSchema).min(1).max(40),
      })
    )
    .mutation(async ({ input }) => {
      const session = await getTableSessionByToken(input.token);

      if (!session || session.status !== "active" || new Date(session.expiresAt) < new Date()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Sessão inválida ou expirada. Escaneie o QR Code da sua mesa para enviar o pedido.",
        });
      }

      // Rate limit: Prevent spamming (minimum 20s between orders from same table session)
      if (session.lastOrderAt) {
        const diffSeconds = (Date.now() - new Date(session.lastOrderAt).getTime()) / 1000;
        if (diffSeconds < 20) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Aguarde alguns segundos antes de enviar outro pedido (${Math.ceil(20 - diffSeconds)}s).`,
          });
        }
      }

      const menuById = new Map(MENU.map((item) => [item.id, item]));
      const normalizedItems = input.items.map((item) => {
        const catalogItem = menuById.get(item.productId);
        if (!catalogItem) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Item não encontrado: ${item.name}` });
        }
        return {
          productId: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          quantity: item.quantity,
          unitPriceCents: catalogItem.priceCents,
          observation: item.observation?.slice(0, 240) ?? "",
        };
      });

      const totalCents = normalizedItems.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0
      );

      const code = makeOrderCode();
      const finalTableName = input.tableName?.trim() || session.tableName;
      const clientName = input.customerName || session.customerName || `Cliente ${finalTableName}`;

      const order = await createOrder({
        code,
        origin: "QR Code Mesa",
        serviceMode: "customer",
        tableName: finalTableName,
        customerName: clientName,
        paymentMethod: input.paymentMethod,
        notes: input.notes?.slice(0, 600) ?? null,
        items: normalizedItems,
        totalCents,
        status: "received",
        operatorName: finalTableName,
      });

      // Update session statistics
      await recordTableOrder(session.token);

      await recordAudit({
        action: "create_order_qr",
        entity: "orders",
        entityId: code,
        user: `Mesa ${session.tableName}`,
        details: { totalCents, itemsCount: normalizedItems.length },
      });

      return { success: true, orderCode: order.code };
    }),

  // ─── Call Waiter / Solicit Service ─────────────────────────────────────────
  callWaiter: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const session = await getTableSessionByToken(input.token);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão inválida" });

      await recordAudit({
        action: "call_waiter",
        entity: "table_sessions",
        entityId: session.tableName,
        user: `Mesa ${session.tableName}`,
        details: { tableName: session.tableName, customerName: session.customerName },
      });

      return { success: true, message: "Garçom chamado com sucesso! Um atendente irá até sua mesa." };
    }),

  // ─── Request Bill ──────────────────────────────────────────────────────────
  requestBill: publicProcedure
    .input(z.object({ token: z.string().min(10) }))
    .mutation(async ({ input }) => {
      const session = await getTableSessionByToken(input.token);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão inválida" });

      await recordAudit({
        action: "request_bill",
        entity: "table_sessions",
        entityId: session.tableName,
        user: `Mesa ${session.tableName}`,
        details: { tableName: session.tableName },
      });

      return { success: true, message: "Conta solicitada! O garçom levará a comanda à mesa." };
    }),

  // ─── Staff: List Table QRs (Mesas) ─────────────────────────────────────────
  listTables: staffProcedure.query(async () => {
    // Generate/retrieve sessions for standard tables 1 to 20 + Balcão
    const defaultTables = [
      ...Array.from({ length: 20 }, (_, i) => `Mesa ${String(i + 1).padStart(2, "0")}`),
      "Balcão 01",
      "Balcão 02",
      "Retirada Rápida",
    ];

    const activeSessions = await listAllTableSessions();
    const sessionByTable = new Map(activeSessions.map((s) => [s.tableName, s]));

    const result = await Promise.all(
      defaultTables.map(async (tableName) => {
        let session = sessionByTable.get(tableName);
        if (!session || session.status !== "active" || new Date(session.expiresAt) < new Date()) {
          session = await createOrGetTableSession(tableName);
        }
        return {
          tableName,
          token: session.token,
          status: session.status,
          expiresAt: session.expiresAt,
          orderCount: session.orderCount,
          customerName: session.customerName,
          qrUrl: `/m/${session.token}`,
        };
      })
    );

    return result;
  }),

  // ─── Staff (Gerente/Dono): Regenerate Table QR ─────────────────────────────
  regenerateQR: staffRoleProcedure(["gerente", "dono", "garcom"])
    .input(z.object({ tableName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const newSession = await regenerateTableToken(input.tableName);

      await recordAudit({
        action: "regenerate_qr",
        entity: "table_sessions",
        entityId: input.tableName,
        user: ctx.staffUser.username,
        details: { newToken: newSession.token },
      });

      return {
        success: true,
        tableName: input.tableName,
        token: newSession.token,
        qrUrl: `/m/${newSession.token}`,
      };
    }),

  // ─── Staff: Close Table Session (Ao pagar / desocupar mesa) ─────────────────
  closeTable: staffProcedure
    .input(z.object({ tableName: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await closeTableSession(input.tableName);

      await recordAudit({
        action: "close_table_session",
        entity: "table_sessions",
        entityId: input.tableName,
        user: ctx.staffUser.username,
      });

      return { success: true };
    }),
});

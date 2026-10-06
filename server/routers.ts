import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MENU, calcTotal } from "../shared/menu";
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
  updateOrderItems,
  updateOrderStatus,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { staffAuthRouter } from "./staffAuthRouter";
import { staffUsersRouter } from "./staffUsersRouter";
import { qrSessionRouter } from "./qrSessionRouter";
import { recordAudit } from "./staffDb";
import type { TrpcContext } from "./_core/context";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0),
  observation: z.string().max(240).optional().default(""),
});

const orderStatusSchema = z.enum(["pending_waiter", "received", "preparing", "ready", "completed", "cancelled"]);
const paymentMethodSchema = z.enum(["pix", "credito", "debito", "dinheiro", "vale_refeicao"]);

function makeOrderCode() {
  return `MC-${Date.now().toString(36).slice(-5).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function isStaffOrAdmin(ctx: TrpcContext): boolean {
  return Boolean((ctx.user && ctx.user.role === "admin") || ctx.staffUser);
}

function hasRole(
  ctx: TrpcContext,
  roles: Array<"garcom" | "caixa" | "cozinha" | "gerente" | "dono" | "administrador" | "master">
): boolean {
  if (ctx.user && ctx.user.role === "admin") return true;
  if (!ctx.staffUser) return false;
  const role = ctx.staffUser.role as string;
  if (role === "master" || role === "dono") return true; // Master tem controle total de todo o sistema!
  if (roles.includes(role as any)) return true;
  if (role === "administrador" && roles.includes("gerente")) return true;
  if (role === "gerente" && roles.includes("administrador")) return true;
  return false;
}

function getOperator(ctx: TrpcContext): string {
  return ctx.staffUser?.name || ctx.user?.name || "Operador";
}

export const appRouter = router({
  system: systemRouter,
  staffAuth: staffAuthRouter,
  staffUsers: staffUsersRouter,
  qrSession: qrSessionRouter,

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
    setPaymentMethods: publicProcedure
      .input(z.object({ methods: z.array(z.string()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à gerência/dono." });
        }
        await setStoreSetting("active_payment_methods", input.methods);
        await recordAudit({
          action: "update_settings",
          entity: "store_settings",
          entityId: "active_payment_methods",
          user: getOperator(ctx),
          details: { methods: input.methods },
        });
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
          status: z.enum(["pending_waiter", "received"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const isStaff = isStaffOrAdmin(ctx);

        // Se o cliente enviar o pedido para validação ou for modo mesa sem autenticação de garçom,
        // o pedido entra como 'pending_waiter' para o garçom conferir antes do preparo
        const initialStatus: "pending_waiter" | "received" =
          input.status ?? (input.serviceMode === "waiter" && !isStaff ? "pending_waiter" : "received");

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

        const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
        const { totalCents } = calcTotal(subtotalCents, input.paymentMethod);
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
          status: initialStatus,
          financialStatus: "pending",
          paidCents: 0,
          operatorName: getOperator(ctx),
        });

        return { order, menu: MENU };
      }),

    get: publicProcedure.input(z.object({ code: z.string().min(1) })).query(async ({ input }) => {
      const order = await getOrderByCode(input.code);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });
      const payments = await getPaymentsForOrder(order.code);
      return { ...order, payments };
    }),

    list: publicProcedure.query(async ({ ctx }) => {
      if (!isStaffOrAdmin(ctx)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
      }
      const rawOrders = await listOrders();

      // Perfil 'cozinha' acompanha a esteira sem ver pedidos ainda não validados pelo garçom
      // e sem dados financeiros
      if (ctx.staffUser?.role === "cozinha") {
        return rawOrders
          .filter((o) => o.status !== "pending_waiter")
          .map((o) => ({
            ...o,
            totalCents: 0,
            paidCents: 0,
            payments: [],
          }));
      }

      return rawOrders;
    }),

    setStatus: publicProcedure
      .input(z.object({ code: z.string().min(1), status: orderStatusSchema }))
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["garcom", "caixa", "cozinha", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe de atendimento/cozinha." });
        }
        const existing = await getOrderByCode(input.code);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });

        // Validação: Bloquear finalização/entrega de pedido de balcão sem pagamento
        if (input.status === "completed" && existing.serviceMode === "counter" && existing.financialStatus !== "paid") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pedidos de balcão precisam estar com o pagamento concluído antes de serem finalizados/entregues.",
          });
        }

        const operator = getOperator(ctx);
        const order = await updateOrderStatus(input.code, input.status, operator);

        await recordAudit({
          action: "update_order_status",
          entity: "orders",
          entityId: input.code,
          user: operator,
          details: { oldStatus: existing.status, newStatus: input.status },
        });

        return order;
      }),

    updateItems: publicProcedure
      .input(
        z.object({
          code: z.string().min(1),
          items: z.array(orderItemSchema).min(1, "O pedido precisa ter ao menos 1 item. Para remover tudo, cancele o pedido.").max(40),
          reason: z.string().max(240).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["garcom", "caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas garçom, caixa ou gerência podem editar pedidos." });
        }
        const existing = await getOrderByCode(input.code);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado" });

        const editableStatuses = ["pending_waiter", "received", "preparing", "ready"];
        if (!editableStatuses.includes(existing.status)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Pedidos entregues ou cancelados não podem mais ser editados.",
          });
        }

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

        const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
        const { totalCents } = calcTotal(subtotalCents, existing.paymentMethod || "");

        const paid = existing.paidCents || 0;
        if (paid > totalCents) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O novo total ficaria menor que o valor já pago. Solicite um estorno ao caixa/gerência antes de remover itens.",
          });
        }

        const operator = getOperator(ctx);
        const order = await updateOrderItems(input.code, normalizedItems, totalCents, operator);

        await recordAudit({
          action: "update_order_items",
          entity: "orders",
          entityId: input.code,
          user: operator,
          details: {
            status: existing.status,
            oldTotalCents: existing.totalCents,
            newTotalCents: totalCents,
            oldItems: existing.items,
            newItems: normalizedItems,
            reason: input.reason?.trim() || undefined,
          },
        });

        return order;
      }),

    cancel: publicProcedure
      .input(z.object({ code: z.string().min(1), reason: z.string().min(3, "Informe o motivo do cancelamento") }))
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["gerente", "dono", "caixa"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o caixa ou gerência podem cancelar pedidos." });
        }
        const operator = getOperator(ctx);
        const order = await cancelOrder(input.code, input.reason, operator);

        await recordAudit({
          action: "cancel_order",
          entity: "orders",
          entityId: input.code,
          user: operator,
          details: { reason: input.reason },
        });

        return order;
      }),

    stats: publicProcedure
      .input(z.object({ period: z.enum(["day", "week", "month", "year"]).default("day") }))
      .query(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso aos relatórios restrito à gerência e dono." });
        }
        return getOrderStats(input.period);
      }),

    listByPeriod: publicProcedure
      .input(z.object({ start: z.string(), end: z.string() }))
      .query(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à gerência e dono." });
        }
        return listOrdersByPeriod(new Date(input.start), new Date(input.end));
      }),
  }),

  payments: router({
    create: publicProcedure
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
        if (!hasRole(ctx, ["caixa", "gerente", "dono", "garcom"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa ou gerência." });
        }
        const operator = getOperator(ctx);

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

        await recordAudit({
          action: "receive_payment",
          entity: "orders",
          entityId: input.orderCode,
          user: operator,
          details: { paymentsCount: input.items.length },
        });

        return { payments: results, order: updatedOrder };
      }),

    refund: publicProcedure
      .input(z.object({ paymentId: z.number().int(), reason: z.string().min(3, "Informe o motivo do estorno") }))
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas a gerência ou dono podem autorizar estornos." });
        }
        const operator = getOperator(ctx);
        const res = await refundPayment(input.paymentId, input.reason, operator);

        await recordAudit({
          action: "refund_payment",
          entity: "payments",
          entityId: String(input.paymentId),
          user: operator,
          details: { reason: input.reason },
        });

        return res;
      }),

    listForOrder: publicProcedure
      .input(z.object({ orderCode: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        if (!isStaffOrAdmin(ctx)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado à equipe." });
        }
        return getPaymentsForOrder(input.orderCode);
      }),
  }),

  cash: router({
    getActive: publicProcedure.query(async ({ ctx }) => {
      if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
      }
      const active = await getActiveCashRegister();
      if (!active) return null;
      return getCashRegisterSummary(active.id);
    }),

    open: publicProcedure
      .input(
        z.object({
          initialAmountCents: z.number().int().min(0, "Fundo de troco não pode ser negativo"),
          operatorName: z.string().min(1).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
        }
        const operator = input.operatorName || getOperator(ctx);
        const register = await openCashRegister(operator, input.initialAmountCents);

        await recordAudit({
          action: "open_cash_register",
          entity: "cash_registers",
          entityId: String(register.id),
          user: operator,
          details: { initialAmountCents: input.initialAmountCents },
        });

        return register;
      }),

    movement: publicProcedure
      .input(
        z.object({
          type: z.enum(["bleed", "supply", "expense"]),
          amountCents: z.number().int().positive("Valor deve ser maior que zero"),
          reason: z.string().min(3, "Justificativa obrigatória"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
        }
        const active = await getActiveCashRegister();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não há nenhum caixa aberto no momento." });
        }
        const responsible = getOperator(ctx);
        const movement = await addCashMovement({
          cashRegisterId: active.id,
          type: input.type,
          amountCents: input.amountCents,
          reason: input.reason,
          responsible,
        });

        await recordAudit({
          action: `cash_movement_${input.type}`,
          entity: "cash_movements",
          entityId: String(movement.id),
          user: responsible,
          details: { amountCents: input.amountCents, reason: input.reason },
        });

        return movement;
      }),

    close: publicProcedure
      .input(
        z.object({
          countedCashCents: z.number().int().min(0, "Valor contado não pode ser negativo"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
        }
        const active = await getActiveCashRegister();
        if (!active) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Não há nenhum caixa aberto para fechar." });
        }
        const operator = getOperator(ctx);
        const closed = await closeCashRegister({
          cashRegisterId: active.id,
          countedCashCents: input.countedCashCents,
          notes: input.notes,
          operatorName: operator,
        });
        const summary = await getCashRegisterSummary(active.id);

        await recordAudit({
          action: "close_cash_register",
          entity: "cash_registers",
          entityId: String(active.id),
          user: operator,
          details: { countedCashCents: input.countedCashCents, differenceCents: closed.differenceCents },
        });

        return { register: closed, summary };
      }),

    listRegisters: publicProcedure.query(async ({ ctx }) => {
      if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
      }
      return listCashRegisters(30);
    }),

    listMovements: publicProcedure
      .input(z.object({ cashRegisterId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
        }
        return listCashMovements(input.cashRegisterId);
      }),

    getSummary: publicProcedure
      .input(z.object({ cashRegisterId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        if (!hasRole(ctx, ["caixa", "gerente", "dono"])) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso reservado ao caixa e gerência." });
        }
        return getCashRegisterSummary(input.cashRegisterId);
      }),
  }),

  audit: router({
    list: publicProcedure.query(async ({ ctx }) => {
      if (!hasRole(ctx, ["gerente", "dono"])) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à gerência e dono." });
      }
      return listAuditLogs(150);
    }),
  }),
});

export type AppRouter = typeof appRouter;

import { and, desc, eq, gte, lte, ne, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  InsertOrder,
  InsertUser,
  InsertPayment,
  InsertCashRegister,
  InsertCashMovement,
  InsertAuditLog,
  orders,
  users,
  payments,
  cashRegisters,
  cashMovements,
  auditLogs,
  storeSettings,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ──────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  updateSet.updatedAt = new Date();
  if (Object.keys(updateSet).length === 1) updateSet.lastSignedIn = new Date();

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({ target: users.openId, set: updateSet as Partial<InsertUser> });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Audit Log ──────────────────────────────────────────────────────────────
export async function recordAudit(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values(log);
  } catch (err) {
    console.error("[AuditLog] Failed to record:", err);
  }
}

export async function listAuditLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// ─── Orders ─────────────────────────────────────────────────────────────────
export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(orders).values(order);
  const created = await db.select().from(orders).where(eq(orders.code, order.code)).limit(1);
  return created[0];
}

export async function listOrders(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);
}

export async function getOrderByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.code, code)).limit(1);
  return result[0];
}

export async function updateOrderStatus(code: string, status: InsertOrder["status"], operatorName?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (operatorName) updateData.operatorName = operatorName;
  await db.update(orders).set(updateData).where(eq(orders.code, code));
  return getOrderByCode(code);
}


export async function cancelOrder(code: string, reason: string, user: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await getOrderByCode(code);
  if (!order) throw new Error("Pedido não encontrado");

  await db
    .update(orders)
    .set({
      status: "cancelled",
      financialStatus: "cancelled",
      cancelledReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(orders.code, code));

  await recordAudit({
    action: "order_cancelled",
    entity: "order",
    entityId: code,
    user,
    reason,
    details: { previousStatus: order.status, totalCents: order.totalCents },
  });

  return getOrderByCode(code);
}

// ─── Payments ───────────────────────────────────────────────────────────────
export async function getPaymentsForOrder(orderCode: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.orderCode, orderCode)).orderBy(desc(payments.createdAt));
}

export async function addPayment(input: {
  orderCode: string;
  method: "pix" | "credito" | "debito" | "dinheiro" | "vale_refeicao";
  amountCents: number;
  receivedCents?: number;
  changeCents?: number;
  cardBrand?: string;
  receiptRef?: string;
  cashRegisterId?: number;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const order = await getOrderByCode(input.orderCode);
  if (!order) throw new Error("Pedido não encontrado");
  if (order.status === "cancelled" || order.financialStatus === "cancelled") {
    throw new Error("Não é possível adicionar pagamento a pedido cancelado");
  }

  // Create payment record
  const [createdPayment] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      orderCode: order.code,
      method: input.method,
      amountCents: input.amountCents,
      receivedCents: input.receivedCents ?? input.amountCents,
      changeCents: input.changeCents ?? 0,
      cardBrand: input.cardBrand || null,
      receiptRef: input.receiptRef || null,
      status: "confirmed",
      cashRegisterId: input.cashRegisterId || null,
      operatorName: input.operatorName,
    })
    .returning();

  // Recalculate order total paid
  const allOrderPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderCode, order.code), eq(payments.status, "confirmed")));

  const totalPaid = allOrderPayments.reduce((sum, p) => sum + p.amountCents, 0);

  let newFinancialStatus: "pending" | "partial" | "paid" = "pending";
  if (totalPaid >= order.totalCents) {
    newFinancialStatus = "paid";
  } else if (totalPaid > 0) {
    newFinancialStatus = "partial";
  }

  // Create summary label of methods used
  const methodsUsed = Array.from(new Set(allOrderPayments.map((p) => p.method)));
  const methodLabelMap: Record<string, string> = {
    pix: "Pix",
    credito: "Crédito",
    debito: "Débito",
    dinheiro: "Dinheiro",
    vale_refeicao: "Vale Refeição",
  };
  const summaryMethod =
    methodsUsed.length > 1
      ? "Dividido (" + methodsUsed.map((m) => methodLabelMap[m] || m).join(" + ") + ")"
      : methodLabelMap[methodsUsed[0]] || "Pago";

  await db
    .update(orders)
    .set({
      paidCents: totalPaid,
      financialStatus: newFinancialStatus,
      paymentMethod: summaryMethod,
      operatorName: input.operatorName,
      updatedAt: new Date(),
    })
    .where(eq(orders.code, order.code));

  await recordAudit({
    action: "payment_created",
    entity: "payment",
    entityId: String(createdPayment.id),
    user: input.operatorName,
    details: {
      orderCode: order.code,
      method: input.method,
      amountCents: input.amountCents,
      financialStatus: newFinancialStatus,
      totalPaid,
    },
  });

  return { payment: createdPayment, order: await getOrderByCode(order.code) };
}

export async function refundPayment(paymentId: number, reason: string, user: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new Error("Pagamento não encontrado");
  if (payment.status === "refunded") throw new Error("Pagamento já estornado");

  await db
    .update(payments)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(payments.id, paymentId));

  // Recalculate order total paid
  const confirmedPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderCode, payment.orderCode), eq(payments.status, "confirmed")));

  const totalPaid = confirmedPayments.reduce((sum, p) => sum + p.amountCents, 0);
  const order = await getOrderByCode(payment.orderCode);
  if (order) {
    let newFinancialStatus: "pending" | "partial" | "paid" | "refunded" = "pending";
    if (totalPaid >= order.totalCents) {
      newFinancialStatus = "paid";
    } else if (totalPaid > 0) {
      newFinancialStatus = "partial";
    } else {
      newFinancialStatus = "refunded";
    }

    await db
      .update(orders)
      .set({
        paidCents: totalPaid,
        financialStatus: newFinancialStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.code, order.code));
  }

  await recordAudit({
    action: "payment_refunded",
    entity: "payment",
    entityId: String(paymentId),
    user,
    reason,
    details: { orderCode: payment.orderCode, refundedAmountCents: payment.amountCents },
  });

  return { success: true };
}

// ─── Cash Registers (Caixa / Turnos) ─────────────────────────────────────────
export async function getActiveCashRegister() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(cashRegisters)
    .where(eq(cashRegisters.status, "open"))
    .orderBy(desc(cashRegisters.openedAt))
    .limit(1);
  return result[0] || null;
}

export async function openCashRegister(operatorName: string, initialAmountCents: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const existing = await getActiveCashRegister();
  if (existing) {
    throw new Error(`Já existe um caixa aberto pelo operador ${existing.operatorName}`);
  }

  const [created] = await db
    .insert(cashRegisters)
    .values({
      operatorName,
      initialAmountCents,
      status: "open",
    })
    .returning();

  await recordAudit({
    action: "cash_register_opened",
    entity: "cash_register",
    entityId: String(created.id),
    user: operatorName,
    details: { initialAmountCents },
  });

  return created;
}

export async function addCashMovement(input: {
  cashRegisterId: number;
  type: "bleed" | "supply" | "expense";
  amountCents: number;
  reason: string;
  responsible: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [movement] = await db
    .insert(cashMovements)
    .values({
      cashRegisterId: input.cashRegisterId,
      type: input.type,
      amountCents: input.amountCents,
      reason: input.reason,
      responsible: input.responsible,
    })
    .returning();

  await recordAudit({
    action: `cash_movement_${input.type}`,
    entity: "cash_movement",
    entityId: String(movement.id),
    user: input.responsible,
    reason: input.reason,
    details: { amountCents: input.amountCents, cashRegisterId: input.cashRegisterId },
  });

  return movement;
}

export async function listCashMovements(cashRegisterId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cashMovements)
    .where(eq(cashMovements.cashRegisterId, cashRegisterId))
    .orderBy(desc(cashMovements.createdAt));
}

export async function closeCashRegister(input: {
  cashRegisterId: number;
  countedCashCents: number;
  notes?: string;
  operatorName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [register] = await db
    .select()
    .from(cashRegisters)
    .where(eq(cashRegisters.id, input.cashRegisterId))
    .limit(1);

  if (!register) throw new Error("Caixa não encontrado");
  if (register.status === "closed") throw new Error("Caixa já foi encerrado");

  // Sum cash payments confirmed during this register
  const cashPayments = await db
    .select({ total: sql<number>`coalesce(sum("amountCents"), 0)::int` })
    .from(payments)
    .where(
      and(
        eq(payments.cashRegisterId, register.id),
        eq(payments.method, "dinheiro"),
        eq(payments.status, "confirmed")
      )
    );
  const totalCashPayments = cashPayments[0]?.total ?? 0;

  // Sum movements
  const movements = await listCashMovements(register.id);
  const totalSupplies = movements.filter((m) => m.type === "supply").reduce((s, m) => s + m.amountCents, 0);
  const totalBleeds = movements.filter((m) => m.type === "bleed").reduce((s, m) => s + m.amountCents, 0);
  const totalExpenses = movements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amountCents, 0);

  const expectedCashCents =
    register.initialAmountCents + totalCashPayments + totalSupplies - totalBleeds - totalExpenses;
  const differenceCents = input.countedCashCents - expectedCashCents;

  const [updated] = await db
    .update(cashRegisters)
    .set({
      status: "closed",
      closedAt: new Date(),
      countedCashCents: input.countedCashCents,
      expectedCashCents,
      differenceCents,
      notes: input.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(cashRegisters.id, register.id))
    .returning();

  await recordAudit({
    action: "cash_register_closed",
    entity: "cash_register",
    entityId: String(register.id),
    user: input.operatorName,
    details: {
      initialAmountCents: register.initialAmountCents,
      totalCashPayments,
      supplies: totalSupplies,
      bleeds: totalBleeds,
      expenses: totalExpenses,
      expectedCashCents,
      countedCashCents: input.countedCashCents,
      differenceCents,
    },
  });

  return updated;
}

export async function getCashRegisterSummary(cashRegisterId: number) {
  const db = await getDb();
  if (!db) return null;

  const [register] = await db
    .select()
    .from(cashRegisters)
    .where(eq(cashRegisters.id, cashRegisterId))
    .limit(1);

  if (!register) return null;

  const registerPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.cashRegisterId, cashRegisterId), eq(payments.status, "confirmed")));

  const movements = await listCashMovements(cashRegisterId);

  const byMethod: Record<string, { count: number; totalCents: number }> = {};
  for (const p of registerPayments) {
    if (!byMethod[p.method]) byMethod[p.method] = { count: 0, totalCents: 0 };
    byMethod[p.method].count++;
    byMethod[p.method].totalCents += p.amountCents;
  }

  const totalCashPayments = byMethod["dinheiro"]?.totalCents ?? 0;
  const totalSupplies = movements.filter((m) => m.type === "supply").reduce((s, m) => s + m.amountCents, 0);
  const totalBleeds = movements.filter((m) => m.type === "bleed").reduce((s, m) => s + m.amountCents, 0);
  const totalExpenses = movements.filter((m) => m.type === "expense").reduce((s, m) => s + m.amountCents, 0);

  const expectedCashCents =
    register.initialAmountCents + totalCashPayments + totalSupplies - totalBleeds - totalExpenses;

  return {
    register,
    movements,
    byMethod,
    totals: {
      initialAmountCents: register.initialAmountCents,
      cashSalesCents: totalCashPayments,
      suppliesCents: totalSupplies,
      bleedsCents: totalBleeds,
      expensesCents: totalExpenses,
      expectedCashCents,
      totalNonCashSalesCents: registerPayments
        .filter((p) => p.method !== "dinheiro")
        .reduce((s, p) => s + p.amountCents, 0),
      grandTotalSalesCents: registerPayments.reduce((s, p) => s + p.amountCents, 0),
    },
  };
}

export async function listCashRegisters(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cashRegisters).orderBy(desc(cashRegisters.openedAt)).limit(limit);
}

// ─── Store Settings ──────────────────────────────────────────────────────────
export async function getStoreSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  if (!result[0]) return defaultValue;
  return result[0].value as T;
}

export async function setStoreSetting(key: string, value: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(storeSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
}

// ─── Orders With Payments & Advanced Stats ──────────────────────────────────
export async function listOrdersByPeriod(start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  const rawOrders = await db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)))
    .orderBy(desc(orders.createdAt))
    .limit(500);

  if (rawOrders.length === 0) return [];

  const orderCodes = rawOrders.map((o) => o.code);
  const rawPayments = await db
    .select()
    .from(payments)
    .where(inArray(payments.orderCode, orderCodes));

  const paymentsMap = new Map<string, typeof rawPayments>();
  for (const p of rawPayments) {
    const list = paymentsMap.get(p.orderCode) || [];
    list.push(p);
    paymentsMap.set(p.orderCode, list);
  }

  return rawOrders.map((o) => ({
    ...o,
    payments: paymentsMap.get(o.code) || [],
  }));
}

export async function getOrderStats(period: "day" | "week" | "month" | "year") {
  const db = await getDb();
  if (!db) {
    return {
      byPayment: [],
      byDate: [],
      topItems: [],
      totals: { orders: 0, revenue: 0, avgTicket: 0 },
    };
  }

  const limit = { day: 30, week: 12, month: 12, year: 5 }[period];

  // Confirmed payments breakdown (REAL revenue by payment method)
  const byPaymentRows = await db.execute(sql`
    SELECT
      p.method as "paymentMethod",
      count(p.id)::int as count,
      coalesce(sum(p."amountCents"), 0)::int as revenue
    FROM payments p
    JOIN orders o ON o.code = p."orderCode"
    WHERE p.status = 'confirmed' AND o.status != 'cancelled'
    GROUP BY p.method
    ORDER BY revenue DESC
  `).catch(() => ({ rows: [] }));

  // Totals from confirmed payments only
  const totalsRows = await db.execute(sql`
    SELECT
      count(DISTINCT o.id)::int as orders,
      coalesce(sum(p."amountCents"), 0)::int as revenue,
      case 
        when count(DISTINCT o.id) > 0 then (coalesce(sum(p."amountCents"), 0) / count(DISTINCT o.id))::int
        else 0
      end as "avgTicket"
    FROM orders o
    LEFT JOIN payments p ON p."orderCode" = o.code AND p.status = 'confirmed'
    WHERE o.status != 'cancelled'
  `).catch(() => ({ rows: [] }));

  // By Date grouping
  const byDateRaw = await db.execute(sql`
    SELECT
      to_char(date_trunc(${period}::text, p."createdAt"), 'YYYY-MM-DD') as label,
      count(DISTINCT p."orderCode")::int as orders,
      coalesce(sum(p."amountCents"), 0)::int as revenue
    FROM payments p
    JOIN orders o ON o.code = p."orderCode"
    WHERE p.status = 'confirmed' AND o.status != 'cancelled'
    GROUP BY date_trunc(${period}::text, p."createdAt")
    ORDER BY date_trunc(${period}::text, p."createdAt") DESC
    LIMIT ${limit}
  `).catch(() => ({ rows: [] }));

  // Top items sold
  const topItemsRaw = await db.execute(sql`
    SELECT
      item->>'name' as name,
      sum((item->>'quantity')::int)::int as qty,
      sum(((item->>'unitPriceCents')::int) * ((item->>'quantity')::int))::int as revenue
    FROM orders, json_array_elements(
      CASE jsonb_typeof(items::jsonb) WHEN 'array' THEN items::jsonb ELSE '[]'::jsonb END
    ) as item
    WHERE status != 'cancelled'
    GROUP BY item->>'name'
    ORDER BY qty DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }));

  return {
    byPayment: (byPaymentRows as any).rows as Array<{ paymentMethod: string; count: number; revenue: number }>,
    byDate: ((byDateRaw as any).rows as Array<{ label: string; orders: number; revenue: number }>).reverse(),
    topItems: (topItemsRaw as any).rows as Array<{ name: string; qty: number; revenue: number }>,
    totals: ((totalsRows as any).rows[0] as { orders: number; revenue: number; avgTicket: number }) ?? {
      orders: 0,
      revenue: 0,
      avgTicket: 0,
    },
  };
}

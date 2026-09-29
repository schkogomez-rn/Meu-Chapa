import { and, desc, eq, gte, lte, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { InsertOrder, InsertUser, orders, users } from "../drizzle/schema";
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
  // Always update updatedAt on upsert
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

export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(orders).values(order);
  const created = await db.select().from(orders).where(eq(orders.code, order.code)).limit(1);
  return created[0];
}

export async function listOrders(limit = 60) {
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

export async function updateOrderStatus(code: string, status: InsertOrder["status"]) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.code, code));
  return getOrderByCode(code);
}

const EMPTY_STATS = {
  byPayment: [] as Array<{ paymentMethod: string; count: number; revenue: number }>,
  byDate: [] as Array<{ label: string; orders: number; revenue: number }>,
  topItems: [] as Array<{ name: string; qty: number; revenue: number }>,
  totals: { orders: 0, revenue: 0, avgTicket: 0 },
};

export async function getOrderStats(period: "day" | "week" | "month" | "year") {
  const db = await getDb();
  if (!db) return EMPTY_STATS;
  const limit = { day: 30, week: 12, month: 12, year: 5 }[period];

  // ── Run independent queries with individual error handling ──
  const byPaymentRows = await db
    .select({
      paymentMethod: orders.paymentMethod,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum("totalCents"), 0)::int`,
    })
    .from(orders)
    .where(ne(orders.status, "cancelled"))
    .groupBy(orders.paymentMethod)
    .orderBy(desc(sql`sum("totalCents")`))
    .catch(() => [] as typeof EMPTY_STATS.byPayment);

  const totalsRows = await db
    .select({
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum("totalCents"), 0)::int`,
      avgTicket: sql<number>`coalesce(avg("totalCents"), 0)::int`,
    })
    .from(orders)
    .where(ne(orders.status, "cancelled"))
    .catch(() => [] as { orders: number; revenue: number; avgTicket: number }[]);

  const byDateRaw = await db.execute(sql`
    SELECT
      to_char(date_trunc(${period}::text, "createdAt"), 'YYYY-MM-DD') as label,
      count(*)::int as orders,
      coalesce(sum("totalCents"), 0)::int as revenue
    FROM orders
    WHERE status != 'cancelled'
    GROUP BY date_trunc(${period}::text, "createdAt")
    ORDER BY date_trunc(${period}::text, "createdAt") DESC
    LIMIT ${limit}
  `).catch(() => ({ rows: [] }));

  // topItems uses json_array_elements — isolated so a bad row doesn't break other stats
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
    byPayment: byPaymentRows,
    byDate: ((byDateRaw as any).rows as Array<{ label: string; orders: number; revenue: number }>).reverse(),
    topItems: (topItemsRaw as any).rows as Array<{ name: string; qty: number; revenue: number }>,
    totals: totalsRows[0] ?? { orders: 0, revenue: 0, avgTicket: 0 },
  };
}

/** Orders within a UTC start–end window, used by the Financial receipts table */
export async function listOrdersByPeriod(start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(and(gte(orders.createdAt, start), lte(orders.createdAt, end)))
    .orderBy(desc(orders.createdAt))
    .limit(500);
}

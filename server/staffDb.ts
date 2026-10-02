import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import {
  auditLogs,
  staffSessions,
  staffUsers,
  tableSessions,
  type InsertAuditLog,
  type InsertStaffSession,
  type InsertStaffUser,
  type InsertTableSession,
  type StaffSession,
  type StaffUser,
  type TableSession,
} from "../drizzle/schema";
import { generateQRToken, generateSecureToken } from "./staffAuthUtils";

// ─── Staff Users ─────────────────────────────────────────────────────────────

export async function getStaffUserByUsername(username: string): Promise<StaffUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.username, username.trim().toLowerCase()))
    .limit(1);
  return result[0] ?? null;
}

export async function getStaffUserById(id: number): Promise<StaffUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(staffUsers).where(eq(staffUsers.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getStaffUserByPin(pin: string): Promise<StaffUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(staffUsers)
    .where(and(eq(staffUsers.pin, pin), eq(staffUsers.active, true)))
    .limit(1);
  return result[0] ?? null;
}

export async function listStaffUsers(): Promise<Omit<StaffUser, "passwordHash">[]> {
  const db = await getDb();
  if (!db) return [];
  const users = await db.select().from(staffUsers).orderBy(desc(staffUsers.createdAt));
  return users.map(({ passwordHash, ...rest }) => rest);
}

export async function createStaffUser(
  data: Omit<InsertStaffUser, "id" | "createdAt" | "updatedAt" | "failedAttempts">
): Promise<StaffUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const [created] = await db
    .insert(staffUsers)
    .values({
      ...data,
      username: data.username.trim().toLowerCase(),
    })
    .returning();
  return created;
}

export async function updateStaffUser(
  id: number,
  data: Partial<Omit<InsertStaffUser, "id" | "username" | "createdAt">>
): Promise<StaffUser | null> {
  const db = await getDb();
  if (!db) return null;

  const [updated] = await db
    .update(staffUsers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(staffUsers.id, id))
    .returning();
  return updated ?? null;
}

export async function recordFailedLogin(user: StaffUser): Promise<{ locked: boolean; attempts: number }> {
  const db = await getDb();
  if (!db) return { locked: false, attempts: 0 };

  const attempts = user.failedAttempts + 1;
  const shouldLock = attempts >= 5;
  const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 minutos

  await db
    .update(staffUsers)
    .set({
      failedAttempts: attempts,
      lockedUntil: shouldLock ? lockedUntil : user.lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(staffUsers.id, user.id));

  return { locked: shouldLock, attempts };
}

export async function resetFailedLogin(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(staffUsers)
    .set({
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(staffUsers.id, userId));
}

// ─── Staff Sessions ──────────────────────────────────────────────────────────

export async function createStaffSession(
  userId: number,
  role: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ token: string; expiresAt: Date }> {
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");

  const token = generateSecureToken(32);
  // Expiração: 4 horas para master/administrador/gerente, 12 horas para garçom/cozinha/balcão
  const durationMs = ["gerente", "dono", "administrador", "master"].includes(role) ? 4 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs);

  await db.insert(staffSessions).values({
    userId,
    token,
    expiresAt,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });

  return { token, expiresAt };
}

export async function getStaffSession(token: string): Promise<{ session: StaffSession; user: StaffUser } | null> {
  const db = await getDb();
  if (!db || !token) return null;

  const result = await db
    .select({
      session: staffSessions,
      user: staffUsers,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffSessions.userId, staffUsers.id))
    .where(and(eq(staffSessions.token, token), gte(staffSessions.expiresAt, new Date()), eq(staffUsers.active, true)))
    .limit(1);

  if (!result[0]) return null;

  // Atualiza lastActiveAt
  await db
    .update(staffSessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(staffSessions.id, result[0].session.id))
    .catch(() => {});

  return result[0];
}

export async function deleteStaffSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db || !token) return;
  await db.delete(staffSessions).where(eq(staffSessions.token, token));
}

// ─── Table Sessions (QR Code) ────────────────────────────────────────────────

export async function getTableSessionByToken(token: string): Promise<TableSession | null> {
  const db = await getDb();
  if (!db || !token) return null;

  const result = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.token, token), eq(tableSessions.status, "active"), gte(tableSessions.expiresAt, new Date())))
    .limit(1);

  return result[0] ?? null;
}

export async function createOrGetTableSession(tableName: string, customerName?: string): Promise<TableSession> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Check if active session exists for this table
  const existing = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableName, tableName), eq(tableSessions.status, "active"), gte(tableSessions.expiresAt, new Date())))
    .limit(1);

  if (existing[0]) {
    if (customerName && !existing[0].customerName) {
      await db
        .update(tableSessions)
        .set({ customerName })
        .where(eq(tableSessions.id, existing[0].id));
      existing[0].customerName = customerName;
    }
    return existing[0];
  }

  // Create new 4-hour session
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

  const [session] = await db
    .insert(tableSessions)
    .values({
      tableName,
      token,
      customerName: customerName ?? null,
      status: "active",
      expiresAt,
    })
    .returning();

  return session;
}

export async function regenerateTableToken(tableName: string): Promise<TableSession> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Invalidate any existing active sessions for this table
  await db
    .update(tableSessions)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(and(eq(tableSessions.tableName, tableName), eq(tableSessions.status, "active")));

  // Generate new token
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

  const [newSession] = await db
    .insert(tableSessions)
    .values({
      tableName,
      token,
      status: "active",
      expiresAt,
    })
    .returning();

  return newSession;
}

export async function closeTableSession(tableName: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(tableSessions)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(and(eq(tableSessions.tableName, tableName), eq(tableSessions.status, "active")));
}

export async function recordTableOrder(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(tableSessions)
    .set({
      orderCount: sql`${tableSessions.orderCount} + 1`,
      lastOrderAt: new Date(),
    })
    .where(eq(tableSessions.token, token));
}

export async function listAllTableSessions(): Promise<TableSession[]> {
  const db = await getDb();
  if (!db) return [];

  // Retorna a sessão ativa mais recente por mesa
  return db
    .select()
    .from(tableSessions)
    .orderBy(desc(tableSessions.openedAt));
}

// ─── Audit Log Helper ────────────────────────────────────────────────────────

export async function recordAudit(data: {
  action: string;
  entity: string;
  entityId: string;
  user: string;
  details?: unknown;
  reason?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(auditLogs).values({
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    user: data.user,
    details: data.details ?? null,
    reason: data.reason ?? null,
  }).catch((err) => console.warn("[AuditLog] Falha ao registrar log:", err));
}

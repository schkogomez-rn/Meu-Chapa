import "dotenv/config";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hashPassword, verifyPassword } from "./staffAuthUtils";
import {
  createOrGetTableSession,
  getTableSessionByToken,
  regenerateTableToken,
  closeTableSession,
  getStaffUserByUsername,
  recordFailedLogin,
  resetFailedLogin,
  createStaffUser,
} from "./staffDb";

function createMockContext(staffUser?: TrpcContext["staffUser"]): TrpcContext {
  return {
    staffUser: staffUser || null,
    staffSessionToken: staffUser ? "mock-session-token" : null,
    user: null,
    req: {
      protocol: "http",
      headers: { "x-forwarded-for": "127.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

describe("Security & Authentication — Passwords & Lockout", () => {
  it("hashes password with random salt and successfully verifies", () => {
    const raw = "MinhaSenhaForte#2026";
    const hashed = hashPassword(raw);
    expect(hashed).toContain(":");
    expect(verifyPassword(raw, hashed)).toBe(true);
    expect(verifyPassword("SenhaErrada#123", hashed)).toBe(false);
  });

  it("locks account after 5 failed attempts", async () => {
    const testUsername = `user_lockout_${Date.now()}`;
    const user = await createStaffUser({
      name: "Teste Lockout",
      username: testUsername,
      passwordHash: hashPassword("SenhaTeste123"),
      role: "garcom",
      active: true,
      mustChangePassword: false,
    });

    let current = user;
    // 4 failed attempts: not yet locked
    for (let i = 0; i < 4; i++) {
      const res = await recordFailedLogin(current);
      expect(res.locked).toBe(false);
      current = { ...current, failedAttempts: res.attempts };
    }

    // 5th attempt locks the account
    const fifth = await recordFailedLogin(current);
    expect(fifth.locked).toBe(true);
    expect(fifth.attempts).toBe(5);

    // Resetting unlocks account
    await resetFailedLogin(user.id);
    const refreshed = await getStaffUserByUsername(testUsername);
    expect(refreshed?.failedAttempts).toBe(0);
    expect(refreshed?.lockedUntil).toBeNull();
  });
});

describe("Role-Based Access Control (RBAC)", () => {
  it("rejects unauthenticated requests to protected staff procedures (401 UNAUTHORIZED)", async () => {
    const ctx = createMockContext(undefined);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.staffUsers.list()).rejects.toThrow();
    await expect(caller.cash.getActive()).rejects.toThrow();
  });

  it("blocks Garçom from cash register management (403 FORBIDDEN)", async () => {
    const ctx = createMockContext({
      id: 99,
      name: "Garçom Silva",
      username: "garcom_silva",
      role: "garcom",
      mustChangePassword: false,
    });
    const caller = appRouter.createCaller(ctx);

    // Garçom cannot open cash register
    await expect(
      caller.cash.open({ initialAmountCents: 10000 })
    ).rejects.toThrow();
  });

  it("blocks Cozinha from financial reports and user management (403 FORBIDDEN)", async () => {
    const ctx = createMockContext({
      id: 98,
      name: "Chapeiro Lucas",
      username: "cozinha_lucas",
      role: "cozinha",
      mustChangePassword: false,
    });
    const caller = appRouter.createCaller(ctx);

    // Cozinha cannot list staff users
    await expect(caller.staffUsers.list()).rejects.toThrow();

    // Cozinha cannot see financial statistics
    await expect(caller.orders.stats({ period: "day" })).rejects.toThrow();
  });

  it("allows Gerente and Dono to access user management and reports", async () => {
    const ctx = createMockContext({
      id: 1,
      name: "Dono",
      username: "dono",
      role: "dono",
      mustChangePassword: false,
    });
    const caller = appRouter.createCaller(ctx);

    const users = await caller.staffUsers.list();
    expect(Array.isArray(users)).toBe(true);
  });

  it("allows Master full control to create Administrator and limited users", async () => {
    const masterCtx = createMockContext({
      id: 6,
      name: "Master",
      username: "master",
      role: "master",
      mustChangePassword: false,
    });
    const masterCaller = appRouter.createCaller(masterCtx);

    // Master creates an Administrator
    const adminUser = await masterCaller.staffUsers.create({
      name: "Admin Carlos",
      username: `admin_${Date.now()}`,
      role: "administrador",
    });
    expect(adminUser.role).toBe("administrador");
    expect(adminUser.tempPassword).toBeDefined();

    // Master creates a limited user (Garçom)
    const waiterUser = await masterCaller.staffUsers.create({
      name: "Garçom João",
      username: `garcom_${Date.now()}`,
      role: "garcom",
    });
    expect(waiterUser.role).toBe("garcom");
  });

  it("prevents Administrator from creating Master or another Administrator, but allows limited users", async () => {
    const adminCtx = createMockContext({
      id: 10,
      name: "Admin",
      username: "admin_test",
      role: "administrador",
      mustChangePassword: false,
    });
    const adminCaller = appRouter.createCaller(adminCtx);

    // Administrator trying to create another Administrator -> REJECTED
    await expect(
      adminCaller.staffUsers.create({
        name: "Outro Admin",
        username: `admin_forbidden_${Date.now()}`,
        role: "administrador",
      })
    ).rejects.toThrow("Apenas o Usuário Master tem permissão para cadastrar Administradores");

    // Administrator trying to create a Master -> REJECTED
    await expect(
      adminCaller.staffUsers.create({
        name: "Novo Master",
        username: `master_forbidden_${Date.now()}`,
        role: "master",
      })
    ).rejects.toThrow("Apenas o Usuário Master tem permissão para cadastrar Administradores");

    // Administrator CAN create limited user (Caixa)
    const cashierUser = await adminCaller.staffUsers.create({
      name: "Caixa Pedro",
      username: `caixa_${Date.now()}`,
      role: "caixa",
    });
    expect(cashierUser.role).toBe("caixa");
  });
});

describe("Customer QR Code Sessions & Token Invalidation", () => {
  it("creates, validates, and invalidates table QR tokens upon regeneration", async () => {
    const tableName = `Mesa Teste ${Date.now()}`;
    const initialSession = await createOrGetTableSession(tableName);
    expect(initialSession.token).toBeDefined();

    // Validate initial session
    const fetched = await getTableSessionByToken(initialSession.token);
    expect(fetched).not.toBeNull();
    expect(fetched?.tableName).toBe(tableName);
    expect(fetched?.status).toBe("active");

    // Manager regenerates QR Code for this table
    const regenerated = await regenerateTableToken(tableName);
    expect(regenerated.token).not.toBe(initialSession.token);

    // The old token is now invalidated!
    const oldCheck = await getTableSessionByToken(initialSession.token);
    expect(oldCheck).toBeNull();

    // The new token is active
    const newCheck = await getTableSessionByToken(regenerated.token);
    expect(newCheck).not.toBeNull();
    expect(newCheck?.status).toBe("active");

    // Closing the table terminates the session
    await closeTableSession(tableName);
    const closedCheck = await getTableSessionByToken(regenerated.token);
    expect(closedCheck).toBeNull();
  });

  it("rejects invalid or non-existent QR tokens via API", async () => {
    const ctx = createMockContext(undefined);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.qrSession.validateSession({ token: "token_falso_inexistente_123" })
    ).rejects.toThrow("Este QR Code é inválido");
  });
});

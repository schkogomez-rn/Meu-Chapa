import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrderByCode: vi.fn(),
  listOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { MENU } from "../shared/menu";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type User = NonNullable<TrpcContext["user"]>;

function context(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const admin: User = {
  id: 1,
  openId: "admin",
  email: "admin@meuchapa.local",
  name: "Equipe Meu Chapa",
  loginMethod: "manus",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.createOrder.mockImplementation(async (input: any) => ({ ...input, id: 1, createdAt: new Date(), updatedAt: new Date() }));
  dbMocks.updateOrderStatus.mockImplementation(async (code: string, status: string) => ({ code, status }));
});

describe("menu.list", () => {
  it("returns the branded catalog to public visitors", async () => {
    const caller = appRouter.createCaller(context());
    const menu = await caller.menu.list();
    expect(menu.length).toBeGreaterThan(20);
    expect(menu.find(item => item.id === "x-salada")?.priceCents).toBe(1800);
  });
});

describe("orders.create", () => {
  it("uses server catalog prices instead of trusting the browser", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.orders.create({
      origin: "Cliente via QR Code",
      serviceMode: "customer",
      tableName: "Mesa 08",
      paymentMethod: "Pix",
      items: [{ productId: "x-salada", name: "X-Salada", category: "Hambúrgueres", quantity: 2, unitPriceCents: 1, observation: "sem cebola" }],
    });
    expect(dbMocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ totalCents: 3600, status: "received", tableName: "Mesa 08" }));
    expect(result.order.totalCents).toBe(3600);
  });

  it("rejects products outside the catalog", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.orders.create({
      origin: "Balcão",
      serviceMode: "counter",
      paymentMethod: "Dinheiro",
      items: [{ productId: "inventado", name: "Produto falso", category: "Bebidas", quantity: 1, unitPriceCents: 100 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createOrder).not.toHaveBeenCalled();
  });
});

describe("orders.setStatus", () => {
  it("allows an admin to advance a kitchen ticket", async () => {
    const caller = appRouter.createCaller(context(admin));
    const result = await caller.orders.setStatus({ code: "MC-123", status: "preparing" });
    expect(dbMocks.updateOrderStatus).toHaveBeenCalledWith("MC-123", "preparing");
    expect(result).toMatchObject({ code: "MC-123", status: "preparing" });
  });

  it("blocks a regular user from the operation board", async () => {
    const regular = { ...admin, role: "user" as const };
    const caller = appRouter.createCaller(context(regular));
    await expect(caller.orders.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

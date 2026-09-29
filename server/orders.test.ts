import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrderByCode: vi.fn(),
  listOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  addPayment: vi.fn(),
  refundPayment: vi.fn(),
  cancelOrder: vi.fn(),
  getActiveCashRegister: vi.fn(),
  openCashRegister: vi.fn(),
  closeCashRegister: vi.fn(),
  addCashMovement: vi.fn(),
  getCashRegisterSummary: vi.fn(),
  getOrderStats: vi.fn(),
  listOrdersByPeriod: vi.fn(),
  getPaymentsForOrder: vi.fn(),
  getStoreSetting: vi.fn(),
  setStoreSetting: vi.fn(),
  listAuditLogs: vi.fn(),
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
  dbMocks.createOrder.mockImplementation(async (input: any) => ({
    ...input,
    id: 1,
    financialStatus: "pending",
    paidCents: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  dbMocks.getOrderByCode.mockImplementation(async (code: string) => ({
    id: 1,
    code,
    origin: "Balcão",
    serviceMode: "counter",
    totalCents: 5000,
    paidCents: 0,
    status: "received",
    financialStatus: "pending",
    paymentMethod: "Na entrega / fechamento",
    items: [],
  }));
  dbMocks.updateOrderStatus.mockImplementation(async (code: string, status: string) => ({
    code,
    status,
  }));
  dbMocks.getPaymentsForOrder.mockResolvedValue([]);
});

describe("menu.list", () => {
  it("returns the branded catalog to public visitors", async () => {
    const caller = appRouter.createCaller(context());
    const menu = await caller.menu.list();
    expect(menu.length).toBeGreaterThan(20);
    expect(menu.find((item) => item.id === "x-salada")?.priceCents).toBe(1800);
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
      items: [
        {
          productId: "x-salada",
          name: "X-Salada",
          category: "Hambúrgueres",
          quantity: 2,
          unitPriceCents: 1,
          observation: "sem cebola",
        },
      ],
    });
    expect(dbMocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCents: 3600,
        status: "received",
        financialStatus: "pending",
        tableName: "Mesa 08",
      })
    );
    expect(result.order.totalCents).toBe(3600);
  });

  it("rejects products outside the catalog", async () => {
    const caller = appRouter.createCaller(context());
    await expect(
      caller.orders.create({
        origin: "Balcão",
        serviceMode: "counter",
        paymentMethod: "Dinheiro",
        items: [
          {
            productId: "inventado",
            name: "Produto falso",
            category: "Bebidas",
            quantity: 1,
            unitPriceCents: 100,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createOrder).not.toHaveBeenCalled();
  });
});

describe("orders.setStatus", () => {
  it("allows an admin to advance a kitchen ticket to preparing", async () => {
    const caller = appRouter.createCaller(context(admin));
    const result = await caller.orders.setStatus({ code: "MC-123", status: "preparing" });
    expect(dbMocks.updateOrderStatus).toHaveBeenCalledWith("MC-123", "preparing");
    expect(result).toMatchObject({ code: "MC-123", status: "preparing" });
  });

  it("blocks completing an unpaid counter order", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.getOrderByCode.mockResolvedValueOnce({
      id: 1,
      code: "MC-BALCAO-1",
      serviceMode: "counter",
      status: "ready",
      financialStatus: "pending",
      totalCents: 3500,
      paidCents: 0,
    });
    await expect(
      caller.orders.setStatus({ code: "MC-BALCAO-1", status: "completed" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("allows completing a fully paid counter order", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.getOrderByCode.mockResolvedValueOnce({
      id: 1,
      code: "MC-BALCAO-PAID",
      serviceMode: "counter",
      status: "ready",
      financialStatus: "paid",
      totalCents: 3500,
      paidCents: 3500,
    });
    const res = await caller.orders.setStatus({ code: "MC-BALCAO-PAID", status: "completed" });
    expect(dbMocks.updateOrderStatus).toHaveBeenCalledWith("MC-BALCAO-PAID", "completed");
    expect(res).toBeDefined();
  });

  it("blocks a regular user from the operation board", async () => {
    const regular = { ...admin, role: "user" as const };
    const caller = appRouter.createCaller(context(regular));
    await expect(caller.orders.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("payments.create", () => {
  it("blocks cash payment when cash register is closed", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.getActiveCashRegister.mockResolvedValueOnce(null);

    await expect(
      caller.payments.create({
        orderCode: "MC-123",
        items: [
          {
            method: "dinheiro",
            amountCents: 3000,
            receivedCents: 5000,
            changeCents: 2000,
          },
        ],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("allows simple electronic payment (pix)", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.addPayment.mockResolvedValueOnce({
      payment: { id: 10, method: "pix", amountCents: 5000, status: "confirmed" },
      order: { code: "MC-123", financialStatus: "paid", paidCents: 5000 },
    });

    const result = await caller.payments.create({
      orderCode: "MC-123",
      items: [
        {
          method: "pix",
          amountCents: 5000,
        },
      ],
    });

    expect(dbMocks.addPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "MC-123",
        method: "pix",
        amountCents: 5000,
      })
    );
    expect(result.payments).toHaveLength(1);
  });

  it("supports split payment with change calculation (dinheiro + pix)", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.getActiveCashRegister.mockResolvedValue({ id: 1, operatorName: "Operador" });

    dbMocks.addPayment
      .mockResolvedValueOnce({
        payment: { id: 1, method: "dinheiro", amountCents: 3000, receivedCents: 5000, changeCents: 2000 },
        order: { code: "MC-SPLIT", paidCents: 3000, financialStatus: "partial" },
      })
      .mockResolvedValueOnce({
        payment: { id: 2, method: "pix", amountCents: 3900 },
        order: { code: "MC-SPLIT", paidCents: 6900, financialStatus: "paid" },
      });

    const result = await caller.payments.create({
      orderCode: "MC-SPLIT",
      items: [
        {
          method: "dinheiro",
          amountCents: 3000,
          receivedCents: 5000,
          changeCents: 2000,
        },
        {
          method: "pix",
          amountCents: 3900,
        },
      ],
    });

    expect(dbMocks.addPayment).toHaveBeenCalledTimes(2);
    expect(result.payments).toHaveLength(2);
  });
});

describe("payments.refund and orders.cancel", () => {
  it("allows refunding a payment with reason", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.refundPayment.mockResolvedValueOnce({ success: true });

    const res = await caller.payments.refund({ paymentId: 10, reason: "Cobrança indevida" });
    expect(dbMocks.refundPayment).toHaveBeenCalledWith(10, "Cobrança indevida", admin.name);
    expect(res).toEqual({ success: true });
  });

  it("allows cancelling an order with required reason", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.cancelOrder.mockResolvedValueOnce({ code: "MC-123", status: "cancelled" });

    const res = await caller.orders.cancel({ code: "MC-123", reason: "Cliente desistiu" });
    expect(dbMocks.cancelOrder).toHaveBeenCalledWith("MC-123", "Cliente desistiu", admin.name);
    expect(res.status).toBe("cancelled");
  });
});

describe("cash control", () => {
  it("opens cash register with initial change amount", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.openCashRegister.mockResolvedValueOnce({
      id: 5,
      operatorName: "Carlos",
      initialAmountCents: 15000,
      status: "open",
    });

    const reg = await caller.cash.open({ initialAmountCents: 15000, operatorName: "Carlos" });
    expect(dbMocks.openCashRegister).toHaveBeenCalledWith("Carlos", 15000);
    expect(reg.initialAmountCents).toBe(15000);
  });

  it("closes cash register and generates reconciliation summary", async () => {
    const caller = appRouter.createCaller(context(admin));
    dbMocks.getActiveCashRegister.mockResolvedValueOnce({ id: 5 });
    dbMocks.closeCashRegister.mockResolvedValueOnce({
      id: 5,
      status: "closed",
      countedCashCents: 45000,
      expectedCashCents: 45000,
      differenceCents: 0,
    });
    dbMocks.getCashRegisterSummary.mockResolvedValueOnce({
      register: { id: 5, status: "closed" },
      totals: { expectedCashCents: 45000, cashSalesCents: 30000 },
    });

    const res = await caller.cash.close({ countedCashCents: 45000, notes: "Conferido sem diferenças" });
    expect(dbMocks.closeCashRegister).toHaveBeenCalledWith({
      cashRegisterId: 5,
      countedCashCents: 45000,
      notes: "Conferido sem diferenças",
      operatorName: admin.name,
    });
    expect(res.register.differenceCents).toBe(0);
  });
});

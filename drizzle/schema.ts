import { integer, json, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const orderStatusEnum = pgEnum("order_status", ["received", "preparing", "ready", "completed", "cancelled"]);
export const financialStatusEnum = pgEnum("financial_status", ["pending", "partial", "paid", "refunded", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["pix", "credito", "debito", "dinheiro", "vale_refeicao"]);
export const paymentStatusEnum = pgEnum("payment_status", ["confirmed", "refunded"]);
export const cashRegisterStatusEnum = pgEnum("cash_register_status", ["open", "closed"]);
export const cashMovementTypeEnum = pgEnum("cash_movement_type", ["bleed", "supply", "expense"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  origin: varchar("origin", { length: 64 }).notNull(),
  serviceMode: varchar("serviceMode", { length: 32 }).notNull(),
  tableName: varchar("tableName", { length: 64 }),
  customerName: varchar("customerName", { length: 120 }),
  paymentMethod: varchar("paymentMethod", { length: 64 }).notNull(), // Intenção inicial ou resumo
  notes: text("notes"),
  items: json("items").notNull(),
  totalCents: integer("totalCents").notNull(),
  status: orderStatusEnum("status").default("received").notNull(), // Operacional
  financialStatus: financialStatusEnum("financialStatus").default("pending").notNull(), // Financeiro
  paidCents: integer("paidCents").default(0).notNull(),
  operatorName: varchar("operatorName", { length: 120 }),
  cancelledReason: text("cancelledReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId"),
  orderCode: varchar("orderCode", { length: 24 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  amountCents: integer("amountCents").notNull(),
  receivedCents: integer("receivedCents"),
  changeCents: integer("changeCents"),
  cardBrand: varchar("cardBrand", { length: 64 }),
  receiptRef: varchar("receiptRef", { length: 120 }),
  status: paymentStatusEnum("status").default("confirmed").notNull(),
  cashRegisterId: integer("cashRegisterId"),
  operatorName: varchar("operatorName", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const cashRegisters = pgTable("cash_registers", {
  id: serial("id").primaryKey(),
  operatorName: varchar("operatorName", { length: 120 }).notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  initialAmountCents: integer("initialAmountCents").default(0).notNull(),
  countedCashCents: integer("countedCashCents"),
  expectedCashCents: integer("expectedCashCents"),
  differenceCents: integer("differenceCents"),
  status: cashRegisterStatusEnum("status").default("open").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const cashMovements = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  cashRegisterId: integer("cashRegisterId").notNull(),
  type: cashMovementTypeEnum("type").notNull(),
  amountCents: integer("amountCents").notNull(),
  reason: text("reason").notNull(),
  responsible: varchar("responsible", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 64 }).notNull(),
  entity: varchar("entity", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  user: varchar("user", { length: 120 }).notNull(),
  details: json("details"),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: json("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
export type CashRegister = typeof cashRegisters.$inferSelect;
export type InsertCashRegister = typeof cashRegisters.$inferInsert;
export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = typeof cashMovements.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
export type StoreSetting = typeof storeSettings.$inferSelect;
export type InsertStoreSetting = typeof storeSettings.$inferInsert;

CREATE TYPE "public"."cash_movement_type" AS ENUM('bleed', 'supply', 'expense');--> statement-breakpoint
CREATE TYPE "public"."cash_register_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."financial_status" AS ENUM('pending', 'partial', 'paid', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'credito', 'debito', 'dinheiro', 'vale_refeicao');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('confirmed', 'refunded');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(64) NOT NULL,
	"entity" varchar(64) NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"user" varchar(120) NOT NULL,
	"details" json,
	"reason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"cashRegisterId" integer NOT NULL,
	"type" "cash_movement_type" NOT NULL,
	"amountCents" integer NOT NULL,
	"reason" text NOT NULL,
	"responsible" varchar(120) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" serial PRIMARY KEY NOT NULL,
	"operatorName" varchar(120) NOT NULL,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp,
	"initialAmountCents" integer DEFAULT 0 NOT NULL,
	"countedCashCents" integer,
	"expectedCashCents" integer,
	"differenceCents" integer,
	"status" "cash_register_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"orderId" integer,
	"orderCode" varchar(24) NOT NULL,
	"method" "payment_method" NOT NULL,
	"amountCents" integer NOT NULL,
	"receivedCents" integer,
	"changeCents" integer,
	"cardBrand" varchar(64),
	"receiptRef" varchar(120),
	"status" "payment_status" DEFAULT 'confirmed' NOT NULL,
	"cashRegisterId" integer,
	"operatorName" varchar(120),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" json NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "store_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "financialStatus" "financial_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paidCents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "operatorName" varchar(120);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelledReason" text;
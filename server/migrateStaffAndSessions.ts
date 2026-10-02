import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { generateTempPassword, hashPassword } from "./staffAuthUtils";

export async function runStaffMigration() {
  const db = await getDb();
  if (!db) {
    console.warn("[Migration] Database connection unavailable for staff migration");
    return;
  }

  // 1. Create Enums if they do not exist
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE staff_role AS ENUM ('garcom', 'caixa', 'cozinha', 'gerente', 'dono', 'administrador', 'master');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  try {
    await db.execute(sql`ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'administrador'`);
  } catch {}
  try {
    await db.execute(sql`ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'master'`);
  } catch {}
  try {
    await db.execute(sql`ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_waiter'`);
  } catch {}

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE table_session_status AS ENUM ('active', 'closed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // 2. Create staff_users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff_users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      username VARCHAR(64) NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      role staff_role DEFAULT 'garcom' NOT NULL,
      pin VARCHAR(6),
      active BOOLEAN DEFAULT TRUE NOT NULL,
      "mustChangePassword" BOOLEAN DEFAULT FALSE NOT NULL,
      "failedAttempts" INTEGER DEFAULT 0 NOT NULL,
      "lockedUntil" TIMESTAMP,
      "lastLoginAt" TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
      "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // 3. Create table_sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS table_sessions (
      id SERIAL PRIMARY KEY,
      "tableName" VARCHAR(64) NOT NULL,
      token VARCHAR(128) NOT NULL UNIQUE,
      "customerName" VARCHAR(120),
      status table_session_status DEFAULT 'active' NOT NULL,
      "openedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "closedAt" TIMESTAMP,
      "lastOrderAt" TIMESTAMP,
      "orderCount" INTEGER DEFAULT 0 NOT NULL
    );
  `);

  // 4. Create staff_sessions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL,
      token VARCHAR(128) NOT NULL UNIQUE,
      "expiresAt" TIMESTAMP NOT NULL,
      "ipAddress" VARCHAR(64),
      "userAgent" TEXT,
      "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
      "lastActiveAt" TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  // 5. Seed initial "master" user (Controle Total)
  const existingMaster = await db.execute(sql`
    SELECT id, username FROM staff_users WHERE username = 'master' OR role = 'master' LIMIT 1;
  `);

  if (!existingMaster.rows || existingMaster.rows.length === 0) {
    const masterPassword = "Master@123";
    const hashedPassword = hashPassword(masterPassword);

    await db.execute(sql`
      INSERT INTO staff_users (name, username, "passwordHash", role, pin, active, "mustChangePassword")
      VALUES ('Usuário Master', 'master', ${hashedPassword}, 'master', '9999', true, false);
    `);

    console.log("\n=======================================================");
    console.log("👑 [MEU CHAPA BURGER] USUÁRIO MASTER CRIADO COM SUCESSO");
    console.log("Perfil: master (Controle Total Supremo)");
    console.log("Usuário: master");
    console.log(`Senha Inicial: ${masterPassword}`);
    console.log("PIN Rápido: 9999");
    console.log("=======================================================\n");
  } else {
    console.log("[StaffAuth] Usuário 'master' já configurado no banco de dados.");
  }
}

if (process.argv[1]?.includes("migrateStaffAndSessions")) {
  runStaffMigration()
    .then(() => {
      console.log("[StaffMigration] Concluída com sucesso.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[StaffMigration] Erro:", err);
      process.exit(1);
    });
}

import "dotenv/config";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";
import { hashPassword } from "../server/staffAuthUtils";

async function setupStaffAccounts() {
  const db = await getDb();
  if (!db) {
    console.error("DB unavailable");
    process.exit(1);
  }

  // 1. Clean vitest temporary generated accounts
  await db.execute(sql`
    DELETE FROM staff_users 
    WHERE username LIKE 'user_lockout_%' 
       OR username LIKE 'admin_179%' 
       OR username LIKE 'garcom_179%' 
       OR username LIKE 'caixa_179%';
  `);

  // 2. Set/Update dono
  const donoHash = hashPassword("Dono@123");
  await db.execute(sql`
    UPDATE staff_users 
    SET "passwordHash" = ${donoHash}, 
        pin = '1234', 
        "mustChangePassword" = false, 
        active = true,
        "failedAttempts" = 0,
        "lockedUntil" = null
    WHERE username = 'dono';
  `);

  // 3. Ensure master has known password and pin
  const masterHash = hashPassword("Master@123");
  await db.execute(sql`
    UPDATE staff_users 
    SET "passwordHash" = ${masterHash}, 
        pin = '9999', 
        "mustChangePassword" = false, 
        active = true,
        "failedAttempts" = 0,
        "lockedUntil" = null
    WHERE username = 'master';
  `);

  // 4. Create default operational accounts if they do not exist
  const accounts = [
    { name: "Gerente Geral", username: "gerente", role: "gerente", pin: "4000", pass: "Gerente@123" },
    { name: "Caixa Balcão", username: "caixa", role: "caixa", pin: "2000", pass: "Caixa@123" },
    { name: "Garçom Salão", username: "garcom", role: "garcom", pin: "3000", pass: "Garcom@123" },
    { name: "Cozinha & Chaparia", username: "cozinha", role: "cozinha", pin: "5000", pass: "Cozinha@123" },
  ];

  for (const acc of accounts) {
    const existing = await db.execute(sql`SELECT id FROM staff_users WHERE username = ${acc.username} LIMIT 1`);
    if (!existing.rows || existing.rows.length === 0) {
      const h = hashPassword(acc.pass);
      await db.execute(sql`
        INSERT INTO staff_users (name, username, "passwordHash", role, pin, active, "mustChangePassword")
        VALUES (${acc.name}, ${acc.username}, ${h}, ${acc.role}, ${acc.pin}, true, false);
      `);
    } else {
      const h = hashPassword(acc.pass);
      await db.execute(sql`
        UPDATE staff_users 
        SET "passwordHash" = ${h}, pin = ${acc.pin}, "mustChangePassword" = false, active = true
        WHERE username = ${acc.username};
      `);
    }
  }

  const all = await db.execute(sql`SELECT id, name, username, role, pin, active FROM staff_users ORDER BY id;`);
  console.log("FINAL_USERS:", JSON.stringify(all.rows, null, 2));
  process.exit(0);
}

setupStaffAccounts().catch((e) => {
  console.error(e);
  process.exit(1);
});

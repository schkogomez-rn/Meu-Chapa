import "dotenv/config";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

async function run() {
  const db = await getDb();
  if (!db) {
    console.error("Database connection unavailable");
    process.exit(1);
  }

  console.log("Checking orders...");
  await db.execute(sql`
    UPDATE orders 
    SET "financialStatus" = 'pending' 
    WHERE "financialStatus" IS NULL;
  `);

  console.log("Ensuring store_settings has active_payment_methods...");
  await db.execute(sql`
    INSERT INTO store_settings (key, value, "updatedAt")
    VALUES ('active_payment_methods', '["Pix", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Vale Refeição"]'::json, now())
    ON CONFLICT (key) DO NOTHING;
  `);

  console.log("Migration script completed successfully!");
}

run().then(() => process.exit(0)).catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

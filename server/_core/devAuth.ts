import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

/**
 * Dev-only login endpoint.
 * Bypasses OAuth by creating a session for OWNER_OPEN_ID directly.
 * Only active when NODE_ENV=development.
 */
export function registerDevAuthRoutes(app: Express) {
  if (ENV.isProduction) return;

  app.post("/api/dev/login", async (req: Request, res: Response) => {
    const ownerOpenId = ENV.ownerOpenId;
    if (!ownerOpenId) {
      res.status(400).json({ error: "OWNER_OPEN_ID not set in .env" });
      return;
    }

    try {
      // Upsert the owner as admin in the database
      await db.upsertUser({
        openId: ownerOpenId,
        name: "Dev Admin",
        email: null,
        loginMethod: "dev",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: "Dev Admin",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, openId: ownerOpenId });
    } catch (error) {
      console.error("[DevAuth] Login failed", error);
      res.status(500).json({ error: "Dev login failed", detail: String(error) });
    }
  });

  console.log("[DevAuth] ⚠️  Dev login endpoint active at POST /api/dev/login (development only)");
}

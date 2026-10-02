import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { StaffUser, User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import cookie from "cookie";
import { getStaffSession } from "../staffDb";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  staffUser: StaffUser | null;
  staffSessionToken: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let staffUser: StaffUser | null = null;
  let staffSessionToken: string | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  try {
    const rawCookies = opts.req.headers.cookie;
    if (rawCookies) {
      const parsed = cookie.parse(rawCookies);
      if (parsed.staff_session) {
        staffSessionToken = parsed.staff_session;
        const sessionData = await getStaffSession(parsed.staff_session);
        if (sessionData) {
          staffUser = sessionData.user;
        }
      }
    }
  } catch {
    staffUser = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    staffUser,
    staffSessionToken,
  };
}


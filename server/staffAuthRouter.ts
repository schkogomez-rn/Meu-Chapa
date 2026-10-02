import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router, staffProcedure } from "./_core/trpc";
import {
  createStaffSession,
  deleteStaffSession,
  getStaffUserById,
  getStaffUserByPin,
  getStaffUserByUsername,
  recordAudit,
  recordFailedLogin,
  resetFailedLogin,
  updateStaffUser,
} from "./staffDb";
import { hashPassword, verifyPassword } from "./staffAuthUtils";
import { getSessionCookieOptions } from "./_core/cookies";

export const staffAuthRouter = router({
  // ─── Login ──────────────────────────────────────────────────────────────────
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(2).max(64),
        password: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getStaffUserByUsername(input.username);
      const ip = (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket.remoteAddress || "local";

      if (!user) {
        await recordAudit({
          action: "login_failed",
          entity: "staff_users",
          entityId: input.username,
          user: input.username,
          details: { reason: "Usuário não encontrado", ip },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Usuário ou senha incorretos.",
        });
      }

      if (!user.active) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Esta conta de colaborador foi desativada.",
        });
      }

      // Check account lockout
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.lockedUntil).getTime() - Date.now()) / (60 * 1000)
        );
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${remainingMinutes} minuto(s).`,
        });
      }

      const isValid = verifyPassword(input.password, user.passwordHash);

      if (!isValid) {
        const { locked, attempts } = await recordFailedLogin(user);
        await recordAudit({
          action: "login_failed",
          entity: "staff_users",
          entityId: String(user.id),
          user: user.username,
          details: { attempts, locked, ip },
        });

        if (locked) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Muitas tentativas incorretas. Conta bloqueada por 15 minutos por segurança.",
          });
        }

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: `Usuário ou senha incorretos. (Tentativa ${attempts} de 5)`,
        });
      }

      // Reset failed attempts upon successful login
      await resetFailedLogin(user.id);

      // Create session
      const userAgent = ctx.req.headers["user-agent"];
      const { token, expiresAt } = await createStaffSession(user.id, user.role, ip, userAgent);

      // Set secure httpOnly cookie
      const cookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("staff_session", token, {
        ...cookieOpts,
        expires: expiresAt,
        httpOnly: true,
        sameSite: "lax",
      });

      await recordAudit({
        action: "login_success",
        entity: "staff_users",
        entityId: String(user.id),
        user: user.username,
        details: { role: user.role, ip },
      });

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
    }),

  // ─── Current User ───────────────────────────────────────────────────────────
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.staffUser) return null;
    return {
      id: ctx.staffUser.id,
      name: ctx.staffUser.name,
      username: ctx.staffUser.username,
      role: ctx.staffUser.role,
      mustChangePassword: ctx.staffUser.mustChangePassword,
    };
  }),

  // ─── Logout ─────────────────────────────────────────────────────────────────
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.staffSessionToken) {
      await deleteStaffSession(ctx.staffSessionToken);
    }
    if (ctx.staffUser) {
      await recordAudit({
        action: "logout",
        entity: "staff_users",
        entityId: String(ctx.staffUser.id),
        user: ctx.staffUser.username,
      });
    }
    const cookieOpts = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie("staff_session", { ...cookieOpts, maxAge: -1 });
    return { success: true };
  }),

  // ─── Change Password (Required on first login or user initiative) ───────────
  changePassword: staffProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fullUser = await getStaffUserById(ctx.staffUser.id);
      if (!fullUser) throw new TRPCError({ code: "NOT_FOUND" });

      const isValid = verifyPassword(input.currentPassword, fullUser.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Senha atual incorreta.",
        });
      }

      const newHash = hashPassword(input.newPassword);
      await updateStaffUser(fullUser.id, {
        passwordHash: newHash,
        mustChangePassword: false,
      });

      await recordAudit({
        action: "password_change",
        entity: "staff_users",
        entityId: String(fullUser.id),
        user: fullUser.username,
      });

      return { success: true, message: "Senha alterada com sucesso!" };
    }),

  // ─── PIN Fast Switch (For shared tablets) ───────────────────────────────────
  switchPin: publicProcedure
    .input(
      z.object({
        pin: z.string().length(4, "O PIN deve conter exatamente 4 dígitos."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await getStaffUserByPin(input.pin);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Nenhum colaborador encontrado com este PIN.",
        });
      }

      const ip = (ctx.req.headers["x-forwarded-for"] as string) || ctx.req.socket.remoteAddress || "local";
      const userAgent = ctx.req.headers["user-agent"];
      const { token, expiresAt } = await createStaffSession(user.id, user.role, ip, userAgent);

      const cookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie("staff_session", token, {
        ...cookieOpts,
        expires: expiresAt,
        httpOnly: true,
        sameSite: "lax",
      });

      await recordAudit({
        action: "pin_switch",
        entity: "staff_users",
        entityId: String(user.id),
        user: user.username,
        details: { role: user.role },
      });

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      };
    }),
});

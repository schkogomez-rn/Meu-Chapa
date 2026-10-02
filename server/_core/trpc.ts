import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const requireStaff = t.middleware(async ({ ctx, next }) => {
  if (!ctx.staffUser) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão da equipe expirada ou inválida. Faça login novamente." });
  }
  return next({
    ctx: {
      ...ctx,
      staffUser: ctx.staffUser,
    },
  });
});

export const staffProcedure = t.procedure.use(requireStaff);

export type StaffRole = "garcom" | "caixa" | "cozinha" | "gerente" | "dono" | "administrador" | "master";

export function staffRoleProcedure(roles: Array<StaffRole>) {
  return t.procedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.staffUser) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão da equipe expirada ou inválida. Faça login novamente." });
      }
      const role = ctx.staffUser.role as StaffRole;
      const isMaster = role === "master" || role === "dono";
      const isAllowed =
        isMaster ||
        roles.includes(role) ||
        (role === "administrador" && roles.includes("gerente")) ||
        (role === "gerente" && roles.includes("administrador"));

      if (!isAllowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não tem permissão para acessar esta área ou operação." });
      }
      return next({
        ctx: {
          ...ctx,
          staffUser: ctx.staffUser,
        },
      });
    })
  );
}


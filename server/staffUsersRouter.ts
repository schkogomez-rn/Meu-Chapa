import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, staffRoleProcedure } from "./_core/trpc";
import {
  createStaffUser,
  getStaffUserById,
  getStaffUserByUsername,
  listStaffUsers,
  recordAudit,
  updateStaffUser,
} from "./staffDb";
import { generateTempPassword, hashPassword } from "./staffAuthUtils";

// Apenas Master, Dono, Administrador ou Gerente podem gerenciar usuários da equipe
const managerProcedure = staffRoleProcedure(["gerente", "dono", "administrador", "master"]);

function isMasterRole(role: string): boolean {
  return role === "master" || role === "dono";
}

function isAdminRole(role: string): boolean {
  return role === "administrador" || role === "gerente";
}

const ALL_STAFF_ROLES = ["garcom", "caixa", "cozinha", "gerente", "dono", "administrador", "master"] as const;

export const staffUsersRouter = router({
  list: managerProcedure.query(async () => {
    return listStaffUsers();
  }),

  create: managerProcedure
    .input(
      z.object({
        name: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
        username: z
          .string()
          .min(3, "Usuário deve ter ao menos 3 caracteres.")
          .regex(/^[a-z0-9._-]+$/, "Usuário deve conter apenas letras minúsculas, números e . - _"),
        role: z.enum(ALL_STAFF_ROLES),
        pin: z.string().length(4).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerRole = ctx.staffUser.role;

      // Regra de segurança hierárquica:
      // Apenas o MASTER (ou Dono) pode criar Administradores, Gerentes ou novos Masters.
      if (["master", "dono", "administrador", "gerente"].includes(input.role) && !isMasterRole(callerRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Apenas o Usuário Master tem permissão para cadastrar Administradores ou novos Masters. Como Administrador, você pode cadastrar usuários com controles limitados (Caixa, Garçom e Cozinha).",
        });
      }

      const existing = await getStaffUserByUsername(input.username);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Este nome de usuário já está em uso.",
        });
      }

      const tempPassword = generateTempPassword();
      const passwordHash = hashPassword(tempPassword);

      const created = await createStaffUser({
        name: input.name,
        username: input.username,
        passwordHash,
        role: input.role,
        pin: input.pin ?? null,
        active: true,
        mustChangePassword: true,
      });

      await recordAudit({
        action: "create_user",
        entity: "staff_users",
        entityId: String(created.id),
        user: ctx.staffUser.username,
        details: { targetUsername: created.username, role: created.role },
      });

      return {
        id: created.id,
        name: created.name,
        username: created.username,
        role: created.role,
        tempPassword, // Exibido apenas na criação para repassar ao colaborador
      };
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(2).optional(),
        role: z.enum(ALL_STAFF_ROLES).optional(),
        pin: z.string().length(4).optional().nullable(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const callerRole = ctx.staffUser.role;
      const targetUser = await getStaffUserById(input.id);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      // Dono/Master não pode ser desativado ou alterado por terceiros
      if (isMasterRole(targetUser.role) && !isMasterRole(callerRole)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Não é permitido alterar a conta do Usuário Master." });
      }

      if (isMasterRole(targetUser.role) && input.active === false) {
        throw new TRPCError({ code: "FORBIDDEN", message: "O Usuário Master principal não pode ser desativado." });
      }

      // Administrador não pode alterar outros Administradores ou Masters
      if (isAdminRole(callerRole)) {
        if (isAdminRole(targetUser.role) && ctx.staffUser.id !== targetUser.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Administradores não podem alterar outros Administradores. Apenas o Master possui essa permissão.",
          });
        }
        if (input.role && ["master", "dono", "administrador", "gerente"].includes(input.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Apenas o Usuário Master pode promover usuários para Administrador ou Master.",
          });
        }
      }

      const updated = await updateStaffUser(input.id, {
        name: input.name,
        role: input.role,
        pin: input.pin,
        active: input.active,
      });

      await recordAudit({
        action: "update_user",
        entity: "staff_users",
        entityId: String(input.id),
        user: ctx.staffUser.username,
        details: { changes: input },
      });

      return updated;
    }),

  resetPassword: managerProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = ctx.staffUser.role;
      const targetUser = await getStaffUserById(input.id);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      if (isMasterRole(targetUser.role) && ctx.staffUser.id !== targetUser.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas o próprio Usuário Master pode redefinir sua senha." });
      }

      if (isAdminRole(callerRole) && (isMasterRole(targetUser.role) || isAdminRole(targetUser.role))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Administradores só podem redefinir senhas dos usuários operacionais (Caixa, Garçom e Cozinha).",
        });
      }

      const tempPassword = generateTempPassword();
      const passwordHash = hashPassword(tempPassword);

      await updateStaffUser(input.id, {
        passwordHash,
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      });

      await recordAudit({
        action: "reset_password",
        entity: "staff_users",
        entityId: String(input.id),
        user: ctx.staffUser.username,
        details: { targetUsername: targetUser.username },
      });

      return {
        id: targetUser.id,
        username: targetUser.username,
        tempPassword,
      };
    }),
});

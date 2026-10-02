import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  CreditCard,
  Crown,
  Info,
  KeyRound,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Primary3DButton } from "@/components/design-system/Primary3DButton";

type StaffRole = "garcom" | "caixa" | "cozinha" | "gerente" | "dono" | "administrador" | "master";

export function StaffUsersManager() {
  const meQuery = trpc.staffAuth.me.useQuery();
  const usersQuery = trpc.staffUsers.list.useQuery();

  const callerRole = (meQuery.data?.role || "") as StaffRole;
  const isMaster = callerRole === "master" || callerRole === "dono";
  const isAdmin = isMaster || callerRole === "administrador" || callerRole === "gerente";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<StaffRole>("administrador");
  const [pin, setPin] = useState("");

  const [createdNotice, setCreatedNotice] = useState<{ username: string; tempPassword: string; role: string } | null>(
    null
  );
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const createMutation = trpc.staffUsers.create.useMutation({
    onSuccess: (data) => {
      usersQuery.refetch();
      setIsModalOpen(false);
      setName("");
      setUsername("");
      setPin("");
      setCreatedNotice({ username: data.username, tempPassword: data.tempPassword, role: data.role });
      setActionMsg({ type: "success", text: `Colaborador @${data.username} criado com sucesso!` });
    },
    onError: (err) => {
      setActionMsg({ type: "error", text: err.message });
    },
  });

  const updateMutation = trpc.staffUsers.update.useMutation({
    onSuccess: () => {
      usersQuery.refetch();
      setActionMsg({ type: "success", text: "Usuário atualizado com sucesso." });
    },
    onError: (err) => {
      setActionMsg({ type: "error", text: err.message });
    },
  });

  const resetPasswordMutation = trpc.staffUsers.resetPassword.useMutation({
    onSuccess: (data) => {
      setCreatedNotice({ username: data.username, tempPassword: data.tempPassword, role: "" });
      setActionMsg({ type: "success", text: `Senha do usuário @${data.username} redefinida!` });
    },
    onError: (err) => {
      setActionMsg({ type: "error", text: err.message });
    },
  });

  const users = usersQuery.data ?? [];

  function openCreateModal() {
    setRole(isMaster ? "administrador" : "garcom");
    setIsModalOpen(true);
  }

  function getRoleBadge(roleName: string) {
    if (roleName === "master" || roleName === "dono") {
      return {
        label: "Master (Supremo)",
        icon: <Crown size={12} />,
        bg: "linear-gradient(135deg, rgba(255, 196, 0, 0.28), rgba(240, 123, 23, 0.2))",
        border: "1px solid rgba(255, 196, 0, 0.5)",
        color: "#ffd44c",
        level: "Total (Supremo)",
        levelColor: "#ffd44c",
      };
    }
    if (roleName === "administrador" || roleName === "gerente") {
      return {
        label: "Administrador",
        icon: <ShieldCheck size={12} />,
        bg: "rgba(240, 123, 23, 0.2)",
        border: "1px solid rgba(240, 123, 23, 0.4)",
        color: "#ff9838",
        level: "Gestão Operacional",
        levelColor: "#ff9838",
      };
    }
    if (roleName === "caixa") {
      return {
        label: "Caixa",
        icon: <CreditCard size={12} />,
        bg: "rgba(59, 130, 246, 0.2)",
        border: "1px solid rgba(59, 130, 246, 0.4)",
        color: "#93c5fd",
        level: "Limitado (PDV / Caixa)",
        levelColor: "#93c5fd",
      };
    }
    if (roleName === "garcom") {
      return {
        label: "Garçom",
        icon: <UtensilsCrossed size={12} />,
        bg: "rgba(34, 197, 94, 0.18)",
        border: "1px solid rgba(34, 197, 94, 0.35)",
        color: "#86efac",
        level: "Limitado (Mesas)",
        levelColor: "#86efac",
      };
    }
    return {
      label: "Cozinha",
      icon: <ChefHat size={12} />,
      bg: "rgba(234, 179, 8, 0.18)",
      border: "1px solid rgba(234, 179, 8, 0.35)",
      color: "#fde047",
      level: "Limitado (KDS)",
      levelColor: "#fde047",
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Access Level Banner */}
      <div
        style={{
          background: isMaster
            ? "linear-gradient(135deg, rgba(255, 196, 0, 0.18), rgba(240, 123, 23, 0.12))"
            : "linear-gradient(135deg, rgba(240, 123, 23, 0.16), rgba(59, 130, 246, 0.1))",
          border: isMaster ? "1px solid rgba(255, 196, 0, 0.4)" : "1px solid rgba(240, 123, 23, 0.35)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
          boxShadow: isMaster ? "0 4px 20px rgba(255, 196, 0, 0.12)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: isMaster ? "rgba(255, 196, 0, 0.25)" : "rgba(240, 123, 23, 0.25)",
              border: isMaster ? "1px solid rgba(255, 196, 0, 0.5)" : "1px solid rgba(240, 123, 23, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isMaster ? "#ffd44c" : "#ff9838",
              flexShrink: 0,
            }}
          >
            {isMaster ? <Crown size={24} /> : <ShieldCheck size={24} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: isMaster ? "#ffd44c" : "#ff9838",
                  letterSpacing: "0.5px",
                }}
              >
                {isMaster ? "Nível Master (Controle Total Supremo)" : "Nível Administrador (Gestão da Operação)"}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#f5e6d3", maxWidth: "780px" }}>
              {isMaster
                ? "Você possui acesso irrestrito ao sistema. Tem a exclusividade de cadastrar Administradores, Gerentes e toda a equipe operacional com controles limitados, além de redefinir credenciais."
                : "Você possui acesso de gestão geral e pode cadastrar colaboradores com controles limitados (Caixa, Garçom e Cozinha). Contas de Administrador e Master são restritas ao Usuário Master."}
            </p>
          </div>
        </div>

        <Primary3DButton icon={<Plus size={16} />} onClick={openCreateModal}>
          Novo Colaborador
        </Primary3DButton>
      </div>

      {actionMsg && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: actionMsg.type === "success" ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)",
            border: `1px solid ${actionMsg.type === "success" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: actionMsg.type === "success" ? "#86efac" : "#fca5a5",
          }}
        >
          <span>{actionMsg.text}</span>
          <button
            onClick={() => setActionMsg(null)}
            style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Temporary Password Notice Card */}
      {createdNotice && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255, 196, 0, 0.22), rgba(240, 123, 23, 0.18))",
            border: "1px solid rgba(255, 196, 0, 0.5)",
            borderRadius: "14px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <KeyRound size={15} style={{ color: "var(--cheddar)" }} />
              <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--cheddar)", textTransform: "uppercase" }}>
                Senha Provisória Gerada com Sucesso
              </span>
            </div>
            <p style={{ margin: "4px 0", fontSize: "14px", color: "#fff" }}>
              Repasse esta senha de primeiro acesso para o usuário <strong>@{createdNotice.username}</strong>:
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
              <code
                style={{
                  background: "#0d0604",
                  color: "#ffd44c",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "18px",
                  fontWeight: 800,
                  letterSpacing: "1.5px",
                  border: "1px solid rgba(255, 196, 0, 0.3)",
                }}
              >
                {createdNotice.tempPassword}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdNotice.tempPassword);
                  setActionMsg({ type: "success", text: "Senha copiada para a área de transferência!" });
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#fff",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Copiar Senha
              </button>
            </div>
            <small style={{ display: "block", color: "#d6be9f", marginTop: "6px" }}>
              O colaborador será solicitado a definir uma nova senha no seu primeiro login.
            </small>
          </div>
          <button
            type="button"
            onClick={() => setCreatedNotice(null)}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: 0,
              color: "#fff",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Entendido / Fechar
          </button>
        </div>
      )}

      {/* Users Table */}
      <div
        style={{
          background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(18, 9, 5, 0.96))",
          border: "1px solid rgba(255, 196, 0, 0.22)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  background: "rgba(0, 0, 0, 0.45)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#a8947f",
                }}
              >
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>Colaborador</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>Usuário</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>Perfil</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>Nível de Controle</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>PIN Tablet</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px" }}>Status</th>
                <th style={{ padding: "14px 16px", textTransform: "uppercase", fontSize: "11px", textAlign: "right" }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const badge = getRoleBadge(u.role);
                const isTargetMaster = u.role === "master" || u.role === "dono";
                const isTargetAdmin = u.role === "administrador" || u.role === "gerente";

                // Authorization check for row actions:
                // An admin cannot modify Master or another Admin
                const canModify = isMaster ? true : !isTargetMaster && !isTargetAdmin;
                const canDeactivate = isMaster ? !isTargetMaster : canModify;

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isTargetMaster ? (
                          <Crown size={15} style={{ color: "#ffd44c" }} />
                        ) : isTargetAdmin ? (
                          <ShieldCheck size={15} style={{ color: "#ff9838" }} />
                        ) : (
                          <User size={14} style={{ color: "#d6be9f" }} />
                        )}
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#ffd44c" }}>@{u.username}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "11px",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          background: badge.bg,
                          border: badge.border,
                          color: badge.color,
                        }}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: badge.levelColor }}>
                        {badge.level}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#d6be9f" }}>
                      {u.pin ? <code style={{ letterSpacing: "2px" }}>{u.pin}</code> : "-"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 750,
                          color: u.active ? "#86efac" : "#fca5a5",
                        }}
                      >
                        {u.active ? <UserCheck size={13} /> : <UserX size={13} />}
                        {u.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        {canModify ? (
                          <>
                            <button
                              type="button"
                              onClick={() => resetPasswordMutation.mutate({ id: u.id })}
                              style={{
                                background: "rgba(255, 255, 255, 0.06)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#ffd44c",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Redefinir senha temporária"
                            >
                              <KeyRound size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                              Redefinir Senha
                            </button>
                            {canDeactivate && (
                              <button
                                type="button"
                                onClick={() => updateMutation.mutate({ id: u.id, active: !u.active })}
                                style={{
                                  background: u.active ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.12)",
                                  border: `1px solid ${
                                    u.active ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"
                                  }`,
                                  color: u.active ? "#fca5a5" : "#86efac",
                                  borderRadius: "6px",
                                  padding: "5px 10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {u.active ? "Desativar" : "Ativar"}
                              </button>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#8c765f", fontStyle: "italic" }}>
                            Gerenciado pelo Master
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Staff User */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#1c0e08",
              border: "1px solid rgba(255, 196, 0, 0.35)",
              borderRadius: "18px",
              padding: "26px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                paddingBottom: "12px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: "22px",
                    color: "#fff",
                    margin: 0,
                    textTransform: "uppercase",
                  }}
                >
                  Novo Colaborador / Acesso
                </h3>
                <small style={{ color: "#d6be9f" }}>
                  {isMaster
                    ? "Como Master, você pode criar Administradores e toda a equipe operacional."
                    : "Como Administrador, cadastre membros para a equipe operacional."}
                </small>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: 0, color: "#d6be9f", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  name,
                  username,
                  role,
                  pin: pin.trim() ? pin.trim() : undefined,
                });
              }}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "4px" }}>
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo (Gerente)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255, 196, 0, 0.25)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "4px" }}>
                  Nome de Usuário (login no sistema)
                </label>
                <input
                  type="text"
                  placeholder="Ex: admin.carlos ou garcom1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  required
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255, 196, 0, 0.25)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "4px" }}>
                  Perfil & Nível de Controle
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  style={{
                    width: "100%",
                    padding: "11px 13px",
                    background: "#0d0604",
                    border: "1px solid rgba(255, 196, 0, 0.35)",
                    borderRadius: "8px",
                    color: "#ffd44c",
                    fontSize: "13px",
                    fontWeight: 700,
                    outline: "none",
                  }}
                >
                  {isMaster && (
                    <>
                      <option value="administrador">
                        🛡️ Administrador (Gestão Operacional, Relatórios, Caixa e Controle da Equipe)
                      </option>
                      <option value="master">
                        👑 Master (Controle Total Supremo do Sistema)
                      </option>
                    </>
                  )}
                  <option value="caixa">
                    💳 Caixa / Balcão (Controle Limitado: PDV, Recebimentos e Sangria)
                  </option>
                  <option value="garcom">
                    🍽️ Garçom / Salão (Controle Limitado: Atendimento, Mesas e Comandas)
                  </option>
                  <option value="cozinha">
                    🍳 Cozinha (Controle Limitado: KDS Esteira da Chapa)
                  </option>
                </select>
                {!isMaster && (
                  <small style={{ display: "block", color: "#a8947f", marginTop: "4px" }}>
                    ℹ️ Apenas o Usuário Master tem permissão para cadastrar novos Administradores.
                  </small>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "4px" }}>
                  PIN Rápido (4 dígitos numéricos, opcional para tablet)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="Ex: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  style={{
                    width: "100%",
                    padding: "10px 13px",
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(255, 196, 0, 0.25)",
                    borderRadius: "8px",
                    color: "#ffd44c",
                    fontSize: "16px",
                    letterSpacing: "6px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#d6be9f",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <Primary3DButton type="submit" isLoading={createMutation.isPending}>
                  Cadastrar e Gerar Senha
                </Primary3DButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

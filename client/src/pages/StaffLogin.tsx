import React, { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Sparkles, User, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { BrandFooter } from "@/components/design-system/BrandFooter";

export default function StaffLogin() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const destination = searchParams.get("destino") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [usePinMode, setUsePinMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // First access password change
  const [changingPasswordUser, setChangingPasswordUser] = useState<{ id: number; username: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loginMutation = trpc.staffAuth.login.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      if (data.mustChangePassword) {
        setChangingPasswordUser({ id: data.id, username: data.username });
        setCurrentPassword(password);
      } else {
        redirectByRole(data.role);
      }
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const pinMutation = trpc.staffAuth.switchPin.useMutation({
    onSuccess: (data) => {
      setErrorMsg(null);
      redirectByRole(data.role);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const changePasswordMutation = trpc.staffAuth.changePassword.useMutation({
    onSuccess: () => {
      setSuccessMsg("Senha atualizada com sucesso! Redirecionando...");
      setTimeout(() => {
        window.location.href = "/equipe/painel";
      }, 1200);
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  function redirectByRole(role: string) {
    // If destination was set via URL param (e.g. ?destino=waiter, ?destino=counter, ?destino=ops)
    if (destination && destination !== "/") {
      const cleanDest = destination.trim().toLowerCase();

      if (cleanDest === "waiter" || cleanDest === "garcom" || cleanDest.includes("garcom")) {
        if (!["garcom", "gerente", "dono", "administrador", "master"].includes(role)) {
          setErrorMsg(`Seu perfil (${role}) não tem acesso ao Modo Garçom.`);
          return;
        }
        window.location.href = "/?modo=garcom";
        return;
      }

      if (cleanDest === "counter" || cleanDest === "balcao" || cleanDest.includes("balcao") || cleanDest.includes("caixa")) {
        if (!["caixa", "gerente", "dono", "administrador", "master"].includes(role)) {
          setErrorMsg(`Seu perfil (${role}) não tem acesso ao Modo Balcão.`);
          return;
        }
        window.location.href = "/?modo=balcao";
        return;
      }

      if (cleanDest === "ops" || cleanDest.includes("ops") || cleanDest.includes("painel")) {
        window.location.href = "/equipe/painel";
        return;
      }

      if (cleanDest.startsWith("/")) {
        window.location.href = cleanDest;
        return;
      }
    }

    // Default route per role
    if (role === "garcom") {
      window.location.href = "/?modo=garcom";
    } else if (role === "caixa") {
      window.location.href = "/?modo=balcao";
    } else {
      window.location.href = "/equipe/painel";
    }
  }

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (usePinMode) {
      if (pin.length !== 4) {
        setErrorMsg("Digite o PIN de 4 dígitos.");
        return;
      }
      pinMutation.mutate({ pin });
    } else {
      if (!username.trim() || !password) {
        setErrorMsg("Preencha o usuário e a senha.");
        return;
      }
      loginMutation.mutate({ username, password });
    }
  }

  function handleChangePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("A confirmação de senha não confere.");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  }

  return (
    <div className="service-picker-wrapper">
      <div className="service-picker-glow glow-top" />
      <div className="service-picker-glow glow-bottom" />

      <div className="service-picker-container" style={{ maxWidth: "480px" }}>
        {/* Brand Header */}
        <header className="service-picker-header">
          <div className="service-picker-logo-box" style={{ maxWidth: "250px" }}>
            <img
              src="/meu-chapa-logo.jpg"
              alt="Meu Chapa Burger"
              className="service-picker-logo-img"
            />
          </div>

          <div className="service-picker-badges">
            <span className="gold-pill">
              <Sparkles size={12} /> Acesso da Equipe
            </span>
            <span className="gold-pill">★ Operação Segura</span>
          </div>

          <h1 className="service-picker-title" style={{ fontSize: "28px" }}>
            Central da <span>Equipe</span>
          </h1>
          <p className="service-picker-subtitle" style={{ fontSize: "13px" }}>
            Identifique-se para acessar o salão, o caixa ou a gestão da chapa.
          </p>
        </header>

        {/* Card Form */}
        <section
          className="environment-card team-portal"
          style={{ width: "100%", padding: "28px 24px" }}
        >
          {errorMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(34, 197, 94, 0.15)",
                border: "1px solid rgba(34, 197, 94, 0.4)",
                color: "#86efac",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "12px",
                marginBottom: "16px",
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form 1: Mandatory Password Change */}
          {changingPasswordUser ? (
            <form onSubmit={handleChangePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ textAlign: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--cheddar)", fontWeight: 800, textTransform: "uppercase" }}>
                  Primeiro Acesso Detectado
                </span>
                <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#fff", margin: "4px 0" }}>
                  Defina sua Nova Senha
                </h3>
                <p style={{ fontSize: "12px", color: "#d6be9f", margin: 0 }}>
                  Olá, <strong>{changingPasswordUser.username}</strong>. Por segurança, crie uma senha pessoal com no mínimo 8 dígitos.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                  Nova Senha (mínimo 8 caracteres)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 196, 0, 0.3)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                  Confirme a Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 196, 0, 0.3)",
                    borderRadius: "10px",
                    color: "#fff",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="portal-primary-btn"
                style={{ width: "100%", marginTop: "8px" }}
              >
                <span>{changePasswordMutation.isPending ? "Salvando..." : "Salvar Senha e Entrar"}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            /* Form 2: Normal Login or Fast PIN */
            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Login mode selector */}
              <div style={{ display: "flex", gap: "6px", background: "rgba(0,0,0,0.3)", padding: "3px", borderRadius: "10px" }}>
                <button
                  type="button"
                  onClick={() => setUsePinMode(false)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border: 0,
                    borderRadius: "8px",
                    background: !usePinMode ? "rgba(255, 196, 0, 0.2)" : "transparent",
                    color: !usePinMode ? "#ffd44c" : "#a8947f",
                    fontWeight: 750,
                    fontSize: "11px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Usuário e Senha
                </button>
                <button
                  type="button"
                  onClick={() => setUsePinMode(true)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border: 0,
                    borderRadius: "8px",
                    background: usePinMode ? "rgba(255, 196, 0, 0.2)" : "transparent",
                    color: usePinMode ? "#ffd44c" : "#a8947f",
                    fontWeight: 750,
                    fontSize: "11px",
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  PIN Rápido (4 Dígitos)
                </button>
              </div>

              {!usePinMode ? (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                      Nome de Usuário
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="Ex: dono, garcom1, caixa"
                        required
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "12px 14px 12px 38px",
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(255, 196, 0, 0.25)",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <User size={16} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--cheddar)" }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                      Senha de Acesso
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        style={{
                          width: "100%",
                          padding: "12px 14px 12px 38px",
                          background: "rgba(0, 0, 0, 0.4)",
                          border: "1px solid rgba(255, 196, 0, 0.25)",
                          borderRadius: "10px",
                          color: "#fff",
                          fontSize: "14px",
                          outline: "none",
                        }}
                      />
                      <LockKeyhole size={16} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--cheddar)" }} />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                    PIN do Colaborador (4 Dígitos)
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      autoFocus
                      required
                      style={{
                        width: "100%",
                        padding: "12px 14px 12px 38px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: "1px solid rgba(255, 196, 0, 0.25)",
                        borderRadius: "10px",
                        color: "#ffd44c",
                        fontSize: "20px",
                        letterSpacing: "8px",
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                    <KeyRound size={16} style={{ position: "absolute", left: "12px", top: "16px", color: "var(--cheddar)" }} />
                  </div>
                  <span style={{ fontSize: "11px", color: "#8c765f", display: "block", marginTop: "4px", textAlign: "center" }}>
                    Ideal para tablets compartilhados entre garçons no salão
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginMutation.isPending || pinMutation.isPending}
                className="portal-primary-btn"
                style={{ width: "100%", marginTop: "10px" }}
              >
                <span>{loginMutation.isPending || pinMutation.isPending ? "Autenticando..." : "Entrar no Sistema"}</span>
                <ArrowRight size={18} />
              </button>

              <div style={{ textAlign: "center", marginTop: "8px" }}>
                <a
                  href="/"
                  style={{
                    fontSize: "12px",
                    color: "#a8947f",
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--cheddar)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#a8947f")}
                >
                  ← Voltar para o Cardápio / Tela Inicial
                </a>
              </div>

              {/* Master Access Note */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "10px 14px",
                  background: "rgba(255, 196, 0, 0.07)",
                  border: "1px dashed rgba(255, 196, 0, 0.3)",
                  borderRadius: "10px",
                  fontSize: "11px",
                  color: "#d6be9f",
                  lineHeight: "1.5",
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#ffd44c", fontWeight: 750, marginBottom: "2px" }}>
                  👑 Acesso Master (Controle Total)
                </div>
                <span>
                  Usuário: <code style={{ color: "#fff", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: "4px" }}>master</code> • Senha: <code style={{ color: "#fff", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: "4px" }}>Master@123</code> ou PIN: <code style={{ color: "#fff", background: "rgba(0,0,0,0.4)", padding: "1px 5px", borderRadius: "4px" }}>9999</code>
                </span>
              </div>
            </form>
          )}
        </section>

        <BrandFooter />
      </div>
    </div>
  );
}

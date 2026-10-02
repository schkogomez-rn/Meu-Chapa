import React from "react";
import { ChevronLeft, Flame, LogOut, Sparkles, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BrandHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  showPills?: boolean;
  compact?: boolean;
}

export function BrandHeader({
  title,
  subtitle,
  onBack,
  showPills = false,
  compact = false,
}: BrandHeaderProps) {
  const staffMe = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const logoutMutation = trpc.staffAuth.logout.useMutation({
    onSuccess: () => {
      window.location.href = "/";
    },
  });

  const staffUser = staffMe.data;

  return (
    <header
      style={{
        background: "rgba(16, 8, 6, 0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255, 196, 0, 0.22)",
        padding: compact ? "10px clamp(16px, 4vw, 36px)" : "16px clamp(16px, 4vw, 36px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffd44c",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            title="Voltar"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div
            style={{
              padding: "2px",
              background: "linear-gradient(135deg, rgba(255, 196, 0, 0.6), rgba(240, 123, 23, 0.4))",
              borderRadius: "10px",
              display: "inline-block",
              boxShadow: "0 4px 15px rgba(240, 123, 23, 0.25)",
            }}
          >
            <img
              src="/meu-chapa-logo.jpg"
              alt="Meu Chapa Burger"
              style={{
                height: compact ? "36px" : "44px",
                width: "auto",
                borderRadius: "8px",
                display: "block",
              }}
            />
          </div>
          <div>
            <span
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: compact ? "18px" : "22px",
                fontWeight: 700,
                color: "#fff9ed",
                letterSpacing: "0.5px",
                lineHeight: 1,
                display: "block",
              }}
            >
              MEU CHAPA <span style={{ color: "var(--cheddar)" }}>BURGER</span>
            </span>
            {subtitle ? (
              <span style={{ fontSize: "11px", color: "#d6be9f", display: "block", marginTop: "2px" }}>
                {subtitle}
              </span>
            ) : (
              <span style={{ fontSize: "10px", color: "#a8947f", display: "block", marginTop: "2px" }}>
                Tradição na Brasa • Est. 2023
              </span>
            )}
          </div>
        </a>

        {showPills && (
          <div style={{ display: "flex", gap: "8px", marginLeft: "12px" }}>
            <span className="gold-pill" style={{ display: "none" }}>
              <Flame size={12} /> Artesanal
            </span>
          </div>
        )}
      </div>

      {title && (
        <div style={{ display: "none" }}>
          <h2 style={{ fontFamily: "Oswald, sans-serif", margin: 0, fontSize: "20px", color: "#fff" }}>{title}</h2>
        </div>
      )}

      {/* Right side actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {staffUser ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 196, 0, 0.25)",
              padding: "4px 12px",
              borderRadius: "999px",
            }}
          >
            <UserCheck size={15} style={{ color: "var(--cheddar)" }} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#fff9ed" }}>{staffUser.name}</span>
              <span style={{ fontSize: "10px", color: "var(--cheddar)", textTransform: "uppercase" }}>
                {staffUser.role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              style={{
                background: "transparent",
                border: 0,
                color: "#f87171",
                cursor: "pointer",
                padding: "4px",
                display: "grid",
                placeItems: "center",
                marginLeft: "4px",
              }}
              title="Sair da equipe"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <a
            href="/equipe/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 750,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#d6be9f",
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "6px 12px",
              borderRadius: "999px",
              textDecoration: "none",
            }}
          >
            <Sparkles size={12} style={{ color: "var(--cheddar)" }} /> Área da Equipe
          </a>
        )}
      </div>
    </header>
  );
}

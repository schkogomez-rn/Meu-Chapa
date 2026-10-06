import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface ThemeToggleProps {
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ compact = false, showLabel = false, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) return null;

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={isDark ? "Ativar Modo Claro (Visual Diurno)" : "Ativar Modo Escuro (Visual Noturno)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: compact ? "6px 10px" : "7px 14px",
        borderRadius: "999px",
        border: isDark ? "1px solid rgba(255, 196, 0, 0.35)" : "1px solid rgba(37, 21, 13, 0.25)",
        background: isDark
          ? "linear-gradient(135deg, rgba(255, 196, 0, 0.15), rgba(240, 123, 23, 0.1))"
          : "linear-gradient(135deg, #fffdfa, #f7ede0)",
        color: isDark ? "#ffd44c" : "#78350f",
        fontSize: "11px",
        fontWeight: 800,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isDark
          ? "0 2px 10px rgba(255, 196, 0, 0.15)"
          : "0 2px 8px rgba(0, 0, 0, 0.08)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: isDark ? "rgba(255, 196, 0, 0.2)" : "rgba(217, 119, 6, 0.15)",
          color: isDark ? "#ffd44c" : "#b45309",
          transition: "transform 0.3s ease",
        }}
      >
        {isDark ? <Sun size={13} /> : <Moon size={13} />}
      </div>

      {showLabel && (
        <span style={{ letterSpacing: "0.4px", textTransform: "uppercase" }}>
          {isDark ? "Claro" : "Escuro"}
        </span>
      )}
    </button>
  );
}

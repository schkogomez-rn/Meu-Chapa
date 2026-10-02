import React from "react";
import { AlertCircle, Check, CircleDollarSign, Clock3, Flame, RefreshCw } from "lucide-react";

export type SystemStatus =
  | "received"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "paid"
  | "pending"
  | "partial"
  | "refunded";

interface StatusBadgeProps {
  status: SystemStatus | string;
  size?: "sm" | "md";
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ReactNode; bg: string; color: string; border: string }
> = {
  received: {
    label: "Recebido",
    icon: <Clock3 size={13} />,
    bg: "rgba(245, 158, 11, 0.15)",
    color: "#fbbf24",
    border: "rgba(245, 158, 11, 0.35)",
  },
  preparing: {
    label: "Na Chapa",
    icon: <Flame size={13} />,
    bg: "rgba(240, 123, 23, 0.2)",
    color: "#ff9838",
    border: "rgba(240, 123, 23, 0.45)",
  },
  ready: {
    label: "Pronto",
    icon: <Check size={13} />,
    bg: "rgba(34, 197, 94, 0.15)",
    color: "#4ade80",
    border: "rgba(34, 197, 94, 0.35)",
  },
  completed: {
    label: "Entregue",
    icon: <Check size={13} />,
    bg: "rgba(92, 130, 59, 0.2)",
    color: "#86efac",
    border: "rgba(92, 130, 59, 0.4)",
  },
  cancelled: {
    label: "Cancelado",
    icon: <AlertCircle size={13} />,
    bg: "rgba(239, 68, 68, 0.15)",
    color: "#f87171",
    border: "rgba(239, 68, 68, 0.35)",
  },
  paid: {
    label: "Pago",
    icon: <CircleDollarSign size={13} />,
    bg: "rgba(34, 197, 94, 0.15)",
    color: "#4ade80",
    border: "rgba(34, 197, 94, 0.35)",
  },
  pending: {
    label: "Pendente",
    icon: <Clock3 size={13} />,
    bg: "rgba(234, 179, 8, 0.15)",
    color: "#facc15",
    border: "rgba(234, 179, 8, 0.35)",
  },
  partial: {
    label: "Parcial",
    icon: <CircleDollarSign size={13} />,
    bg: "rgba(59, 130, 246, 0.15)",
    color: "#93c5fd",
    border: "rgba(59, 130, 246, 0.35)",
  },
  refunded: {
    label: "Estornado",
    icon: <RefreshCw size={13} />,
    bg: "rgba(168, 85, 247, 0.15)",
    color: "#c084fc",
    border: "rgba(168, 85, 247, 0.35)",
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const cfg = statusConfig[status] || {
    label: status,
    icon: <Clock3 size={13} />,
    bg: "rgba(255, 255, 255, 0.1)",
    color: "#d6be9f",
    border: "rgba(255, 255, 255, 0.2)",
  };

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? "4px" : "6px",
        padding: isSmall ? "2px 7px" : "4px 10px",
        borderRadius: "999px",
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontSize: isSmall ? "10px" : "11px",
        fontWeight: 750,
        letterSpacing: "0.4px",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

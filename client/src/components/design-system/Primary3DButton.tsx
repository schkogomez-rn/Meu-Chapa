import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

interface Primary3DButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  showArrow?: boolean;
  fullWidth?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger";
}

export function Primary3DButton({
  children,
  icon,
  showArrow = false,
  fullWidth = false,
  isLoading = false,
  variant = "primary",
  disabled,
  style,
  ...props
}: Primary3DButtonProps) {
  let bg = "linear-gradient(135deg, #ffc400 0%, #f07b17 100%)";
  let color = "#120704";
  let shadowColor = "#9c5500";
  let border = "0";

  if (variant === "secondary") {
    bg = "rgba(43, 23, 14, 0.85)";
    color = "#ffd875";
    shadowColor = "#1a0b06";
    border = "1px solid rgba(255, 196, 0, 0.35)";
  } else if (variant === "danger") {
    bg = "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)";
    color = "#ffffff";
    shadowColor = "#7f1d1d";
  }

  return (
    <button
      disabled={disabled || isLoading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "9px",
        background: disabled ? "rgba(255, 255, 255, 0.1)" : bg,
        color: disabled ? "#7d6b59" : color,
        border,
        borderRadius: "12px",
        padding: "14px 22px",
        fontSize: "13px",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        cursor: disabled || isLoading ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : "auto",
        boxShadow: disabled ? "none" : `0 5px 0 ${shadowColor}, 0 8px 20px rgba(0, 0, 0, 0.35)`,
        transition: "transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 7px 0 ${shadowColor}, 0 12px 25px rgba(0, 0, 0, 0.45)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = `0 5px 0 ${shadowColor}, 0 8px 20px rgba(0, 0, 0, 0.35)`;
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = "translateY(2px)";
          e.currentTarget.style.boxShadow = `0 2px 0 ${shadowColor}, 0 4px 10px rgba(0, 0, 0, 0.35)`;
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 7px 0 ${shadowColor}, 0 12px 25px rgba(0, 0, 0, 0.45)`;
        }
      }}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      <span>{children}</span>
      {showArrow && !isLoading && <ArrowRight size={16} />}
    </button>
  );
}

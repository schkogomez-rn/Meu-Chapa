import React from "react";

export function BrandFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        background: "rgba(13, 6, 4, 0.95)",
        padding: "24px 20px",
        textAlign: "center",
        color: "#856f5a",
        fontSize: "12px",
        letterSpacing: "0.3px",
      }}
    >
      <div style={{ maxWidth: "1140px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "6px" }}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} Meu Chapa Burger • Qualidade Garantida desde 2023 • Feito com paixão na chapa
        </p>
        <span style={{ fontSize: "10px", color: "#6e5a47" }}>
          Sistema Integrado de Pedidos, Salão, Balcão e Cozinha
        </span>
      </div>
    </footer>
  );
}

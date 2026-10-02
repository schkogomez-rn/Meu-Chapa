import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Printer, QrCode, RefreshCw, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Primary3DButton } from "@/components/design-system/Primary3DButton";
import { formatDateTime } from "@/components/design-system/Formatters";

export function TableQRManager() {
  const tablesQuery = trpc.qrSession.listTables.useQuery(undefined, { refetchInterval: 15000 });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const regenerateMutation = trpc.qrSession.regenerateQR.useMutation({
    onSuccess: (data) => {
      tablesQuery.refetch();
      setAlertMsg({
        type: "success",
        text: `QR Code da ${data.tableName} regenerado com sucesso! O anterior foi invalidado.`,
      });
    },
    onError: (err) => {
      setAlertMsg({ type: "error", text: err.message });
    },
  });

  const closeTableMutation = trpc.qrSession.closeTable.useMutation({
    onSuccess: () => {
      tablesQuery.refetch();
      setAlertMsg({ type: "success", text: "Mesa encerrada com sucesso." });
    },
    onError: (err) => {
      setAlertMsg({ type: "error", text: err.message });
    },
  });

  const tables = tablesQuery.data ?? [];

  function copyLink(token: string) {
    const fullUrl = `${window.location.origin}/m/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  function handlePrintAll() {
    window.print();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header action row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
            Mesas & QR Codes Digitais
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#d6be9f" }}>
            Cada mesa possui um token criptográfico único. Regenerar invalida imediatamente o QR anterior.
          </p>
        </div>
        <Primary3DButton icon={<Printer size={16} />} onClick={handlePrintAll}>
          Imprimir Cartões de Mesa
        </Primary3DButton>
      </div>

      {alertMsg && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: alertMsg.type === "success" ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)",
            border: `1px solid ${alertMsg.type === "success" ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: alertMsg.type === "success" ? "#86efac" : "#fca5a5",
          }}
        >
          <span>{alertMsg.text}</span>
          <button onClick={() => setAlertMsg(null)} style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Grid of Tables */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "18px",
        }}
      >
        {tables.map((t) => {
          const qrLink = `${window.location.origin}${t.qrUrl}`;
          // Generate standard QR code image URL for preview and printing
          const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrLink)}&color=0-0-0&bgcolor=255-255-255`;

          return (
            <div
              key={t.tableName}
              style={{
                background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(18, 9, 5, 0.96))",
                border: "1px solid rgba(255, 196, 0, 0.25)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    background: "linear-gradient(135deg, #ffd44c, #f07b17)",
                    color: "#120704",
                    fontWeight: 900,
                    fontSize: "12px",
                    padding: "3px 10px",
                    borderRadius: "6px",
                    textTransform: "uppercase",
                  }}
                >
                  {t.tableName}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: t.status === "active" ? "#86efac" : "#fca5a5",
                    fontWeight: 700,
                  }}
                >
                  {t.status === "active" ? "● Ativa" : "○ Fechada"}
                </span>
              </div>

              {/* QR Code Container */}
              <div
                style={{
                  background: "#fff",
                  padding: "10px",
                  borderRadius: "12px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                  width: "140px",
                  height: "140px",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <img
                  src={qrImgUrl}
                  alt={`QR Code ${t.tableName}`}
                  style={{ width: "120px", height: "120px", display: "block" }}
                />
              </div>

              <div style={{ width: "100%", fontSize: "11px", color: "#a8947f" }}>
                <span>Token: </span>
                <code style={{ color: "#ffd44c" }}>{t.token.slice(0, 10)}...</code>
                {t.customerName && (
                  <div style={{ color: "#fff", marginTop: "2px" }}>
                    Cliente: <strong>{t.customerName}</strong>
                  </div>
                )}
                <div style={{ marginTop: "4px" }}>
                  Expira: {formatDateTime(t.expiresAt)}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ width: "100%", display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => copyLink(t.token)}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    background: copiedToken === t.token ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.08)",
                    border: `1px solid ${copiedToken === t.token ? "#86efac" : "rgba(255, 255, 255, 0.15)"}`,
                    color: copiedToken === t.token ? "#86efac" : "#fff",
                    borderRadius: "8px",
                    padding: "8px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Copy size={13} />
                  {copiedToken === t.token ? "Copiado!" : "Copiar Link"}
                </button>

                <button
                  type="button"
                  title="Invalida o QR atual e gera um novo imediatamente"
                  disabled={regenerateMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Deseja regenerar o QR da ${t.tableName}? O QR anterior deixará de funcionar imediatamente.`)) {
                      regenerateMutation.mutate({ tableName: t.tableName });
                    }
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(240, 123, 23, 0.15)",
                    border: "1px solid rgba(240, 123, 23, 0.35)",
                    color: "#ff9838",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

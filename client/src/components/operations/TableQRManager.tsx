import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChefHat,
  Copy,
  ExternalLink,
  Flame,
  Printer,
  QrCode,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Primary3DButton } from "@/components/design-system/Primary3DButton";
import { formatDateTime } from "@/components/design-system/Formatters";

interface EnvironmentQR {
  id: "cliente" | "garcom" | "cozinha";
  title: string;
  badge: string;
  roleDescription: string;
  instructions: string;
  path: string;
  icon: React.ReactNode;
  accentColor: string;
  bgGradient: string;
}

export function TableQRManager() {
  const tablesQuery = trpc.qrSession.listTables.useQuery(undefined, { refetchInterval: 15000 });
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activePrintTarget, setActivePrintTarget] = useState<"all_environments" | "all_tables" | string | null>(null);

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
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";

  // ─── 3 QR Codes Mestres dos Ambientes ──────────────────────────────────────
  const environments: EnvironmentQR[] = [
    {
      id: "cliente",
      title: "Área do Cliente",
      badge: "📱 Autoatendimento",
      roleDescription: "Cardápio Digital completo com fotos, combos e adicionais.",
      instructions: "O cliente aponta a câmera, monta o pedido e indica/seleciona sua mesa na finalização.",
      path: "/cliente",
      icon: <QrCode size={22} />,
      accentColor: "#ffd44c",
      bgGradient: "linear-gradient(135deg, rgba(255, 196, 0, 0.15), rgba(240, 123, 23, 0.08))",
    },
    {
      id: "garcom",
      title: "Área do Garçom",
      badge: "🤵 Atendimento & Mesas",
      roleDescription: "Lançamento ágil de pedidos e gestão de comandas das mesas.",
      instructions: "O garçom seleciona a mesa desejada em 1 clique e envia as comandas direto para a chapa.",
      path: "/garcom",
      icon: <Users size={22} />,
      accentColor: "#60a5fa",
      bgGradient: "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.08))",
    },
    {
      id: "cozinha",
      title: "Área da Cozinha",
      badge: "👨‍🍳 Esteira KDS da Chapa",
      roleDescription: "Painel de produção em tempo real para tablets e telas da cozinha.",
      instructions: "Visualização imediata dos lanches recebidos, em preparo na chapa e prontos para entrega.",
      path: "/cozinha",
      icon: <Flame size={22} />,
      accentColor: "#f97316",
      bgGradient: "linear-gradient(135deg, rgba(240, 123, 23, 0.18), rgba(220, 38, 38, 0.08))",
    },
  ];

  function copyToClipboard(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2500);
  }

  function handlePrintSpecific(target: "all_environments" | "all_tables" | string) {
    setActivePrintTarget(target);
    setTimeout(() => {
      window.print();
    }, 100);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Print CSS Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-sheet, .printable-sheet * {
            visibility: visible;
          }
          .printable-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff !important;
            color: #000 !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header action row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
            Central de QR Codes • Ambientes & Mesas
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#d6be9f" }}>
            Gere, imprima e compartilhe os QR Codes da Área do Cliente, Garçom, Cozinha e Mesas do Salão.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Primary3DButton icon={<Printer size={16} />} onClick={() => handlePrintSpecific("all_environments")}>
            Imprimir 3 Áreas (Cliente, Garçom, Cozinha)
          </Primary3DButton>
          <button
            type="button"
            onClick={() => handlePrintSpecific("all_tables")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 196, 0, 0.3)",
              color: "#ffd44c",
              borderRadius: "10px",
              padding: "9px 16px",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <Printer size={15} /> Imprimir Cartões de Mesas
          </button>
        </div>
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

      {/* ═════════════════════════════════════════════════════════════════════
          SEÇÃO 1: OS 3 QR CODES MESTRES DOS AMBIENTES
         ═════════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(18, 9, 5, 0.98))",
          border: "1px solid rgba(255, 196, 0, 0.35)",
          borderRadius: "18px",
          padding: "24px",
          boxShadow: "0 10px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px", paddingBottom: "14px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(255, 196, 0, 0.15)", color: "#ffd44c", display: "grid", placeItems: "center" }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
              QR Codes Principais dos Ambientes
            </h3>
            <span style={{ fontSize: "12px", color: "#a8947f" }}>
              Placas para afixar no balcão, nas paredes, nas estações dos garçons ou no monitor da cozinha.
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {environments.map((env) => {
            const fullUrl = `${currentOrigin}${env.path}`;
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(fullUrl)}&color=0-0-0&bgcolor=255-255-255&margin=10`;
            const isCopied = copiedLink === env.id;

            return (
              <div
                key={env.id}
                style={{
                  background: "rgba(20, 10, 6, 0.85)",
                  border: `1px solid ${env.accentColor}44`,
                  borderTop: `4px solid ${env.accentColor}`,
                  borderRadius: "16px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "14px",
                  position: "relative",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
                }}
              >
                {/* Header badge */}
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span
                    style={{
                      background: `${env.accentColor}22`,
                      color: env.accentColor,
                      border: `1px solid ${env.accentColor}55`,
                      fontWeight: 800,
                      fontSize: "11px",
                      padding: "3px 10px",
                      borderRadius: "6px",
                      textTransform: "uppercase",
                    }}
                  >
                    {env.badge}
                  </span>
                  <span style={{ fontSize: "11px", color: "#a8947f" }}>{env.path}</span>
                </div>

                <div>
                  <h4 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
                    {env.title}
                  </h4>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#d6be9f", minHeight: "34px" }}>
                    {env.roleDescription}
                  </p>
                </div>

                {/* QR Code Frame */}
                <div
                  style={{
                    background: "#fff",
                    padding: "12px",
                    borderRadius: "14px",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
                    width: "180px",
                    height: "180px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <img
                    src={qrImgUrl}
                    alt={`QR Code ${env.title}`}
                    style={{ width: "156px", height: "156px", display: "block" }}
                  />
                </div>

                <div style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "8px 10px", fontSize: "11px", color: "#a8947f" }}>
                  <span style={{ color: "#ffd44c", fontWeight: 700 }}>Como funciona: </span>
                  {env.instructions}
                </div>

                {/* Action buttons */}
                <div style={{ width: "100%", display: "flex", gap: "8px", marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fullUrl, env.id)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      background: isCopied ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${isCopied ? "#86efac" : "rgba(255, 255, 255, 0.15)"}`,
                      color: isCopied ? "#86efac" : "#fff",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Copy size={13} />
                    {isCopied ? "Copiado!" : "Copiar Link"}
                  </button>

                  <a
                    href={env.path}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      background: "rgba(255, 196, 0, 0.12)",
                      border: "1px solid rgba(255, 196, 0, 0.35)",
                      color: "#ffd44c",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    <ExternalLink size={13} /> Abrir
                  </a>

                  <button
                    type="button"
                    title="Imprimir esta placa individualmente"
                    onClick={() => handlePrintSpecific(env.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      color: "#fff",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          SEÇÃO 2: QR CODES ESPECÍFICOS DE MESAS INDIVIDUAIS
         ═════════════════════════════════════════════════════════════════════ */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
              Cartões de Mesas Individuais (Mesa 01 a 20 + Balcões)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a8947f" }}>
              QR Codes vinculados diretamente a cada mesa. O cliente escaneia e sua mesa já vem pré-selecionada.
            </p>
          </div>
          <span style={{ background: "rgba(255, 196, 0, 0.15)", color: "#ffd44c", borderRadius: "999px", padding: "4px 12px", fontSize: "12px", fontWeight: 800 }}>
            {tables.length} mesas cadastradas
          </span>
        </div>

        {/* Grid of Tables */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "18px",
          }}
        >
          {tables.map((t) => {
            const qrLink = `${currentOrigin}${t.qrUrl}`;
            const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrLink)}&color=0-0-0&bgcolor=255-255-255`;
            const isCopied = copiedLink === t.token;

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
                    onClick={() => copyToClipboard(qrLink, t.token)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      background: isCopied ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.08)",
                      border: `1px solid ${isCopied ? "#86efac" : "rgba(255, 255, 255, 0.15)"}`,
                      color: isCopied ? "#86efac" : "#fff",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Copy size={13} />
                    {isCopied ? "Copiado!" : "Copiar Link"}
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

      {/* ═════════════════════════════════════════════════════════════════════
          FOLHA DE IMPRESSÃO (EXIBIDA SOMENTE DURANTE O PRINT)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="printable-sheet" style={{ display: "none" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h1 style={{ fontSize: "28px", margin: "0 0 6px", textTransform: "uppercase" }}>
            🍔 MEU CHAPA BURGER • PLACAS DE ACESSO
          </h1>
          <p style={{ fontSize: "14px", color: "#555" }}>
            Aponte a câmera do seu smartphone para acessar o sistema.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px" }}>
          {environments.map((env) => (
            <div
              key={env.id}
              style={{
                border: "2px solid #000",
                borderRadius: "12px",
                padding: "20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <h2 style={{ fontSize: "20px", textTransform: "uppercase", margin: 0 }}>
                {env.title}
              </h2>
              <span style={{ fontSize: "12px", fontWeight: "bold" }}>{env.badge}</span>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${currentOrigin}${env.path}`)}&margin=6`}
                alt={env.title}
                style={{ width: "180px", height: "180px" }}
              />
              <p style={{ fontSize: "11px", margin: "4px 0" }}>{env.instructions}</p>
              <code style={{ fontSize: "10px" }}>{`${currentOrigin}${env.path}`}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

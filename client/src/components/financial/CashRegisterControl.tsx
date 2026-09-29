import React, { useState } from "react";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Lock,
  Unlock,
  Printer,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface Props {
  onRefreshNeeded?: () => void;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CashRegisterControl({ onRefreshNeeded }: Props) {
  const activeQuery = trpc.cash.getActive.useQuery(undefined, { refetchInterval: 15000 });
  const openMutation = trpc.cash.open.useMutation({
    onSuccess: () => {
      activeQuery.refetch();
      onRefreshNeeded?.();
      setModalMode(null);
    },
    onError: (err) => alert(err.message),
  });

  const movementMutation = trpc.cash.movement.useMutation({
    onSuccess: () => {
      activeQuery.refetch();
      onRefreshNeeded?.();
      setModalMode(null);
    },
    onError: (err) => alert(err.message),
  });

  const closeMutation = trpc.cash.close.useMutation({
    onSuccess: (data) => {
      activeQuery.refetch();
      onRefreshNeeded?.();
      setModalMode(null);
      if (data.summary) {
        printCashSummary(data.summary);
      }
    },
    onError: (err) => alert(err.message),
  });

  const [modalMode, setModalMode] = useState<"open" | "movement" | "close" | null>(null);
  const [movementType, setMovementType] = useState<"bleed" | "supply" | "expense">("bleed");
  const [amountStr, setAmountStr] = useState("");
  const [reasonStr, setReasonStr] = useState("");
  const [operatorStr, setOperatorStr] = useState("");
  const [countedCashStr, setCountedCashStr] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  const active = activeQuery.data;

  const parseCents = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  const printCashSummary = (summaryData: any) => {
    const reg = summaryData.register;
    const totals = summaryData.totals;
    const movements = summaryData.movements || [];
    const byMethod = summaryData.byMethod || {};

    const popup = window.open("", "_blank", "width=440,height=750");
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Fechamento de Caixa #${reg.id}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body { font-family: monospace, sans-serif; width: 72mm; margin: 0; color: #111; font-size: 11px; line-height: 1.4; }
          .center { text-align: center; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .line { border-bottom: 1px dashed #444; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .bold { font-weight: bold; }
          .diff-ok { color: green; }
          .diff-bad { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="title">MEU CHAPA BURGER</div>
          <div>FECHAMENTO DE CAIXA / TURNO</div>
          <div>Caixa #${reg.id} · Operador: ${reg.operatorName}</div>
          <div>Abertura: ${new Date(reg.openedAt).toLocaleString("pt-BR")}</div>
          <div>Fechamento: ${reg.closedAt ? new Date(reg.closedAt).toLocaleString("pt-BR") : "Aberto"}</div>
        </div>
        <div class="line"></div>
        <div class="bold">1. FLUXO DE DINHEIRO EM ESPÉCIE</div>
        <div class="row"><span>(+) Fundo Inicial Troco:</span><span>${money(totals.initialAmountCents)}</span></div>
        <div class="row"><span>(+) Vendas em Dinheiro:</span><span>${money(totals.cashSalesCents)}</span></div>
        <div class="row"><span>(+) Suprimentos de Caixa:</span><span>${money(totals.suppliesCents)}</span></div>
        <div class="row"><span>(-) Sangrias Realizadas:</span><span>${money(totals.bleedsCents)}</span></div>
        <div class="row"><span>(-) Despesas Pagas:</span><span>${money(totals.expensesCents)}</span></div>
        <div class="line"></div>
        <div class="row bold"><span>(=) DINHEIRO ESPERADO:</span><span>${money(totals.expectedCashCents)}</span></div>
        <div class="row bold"><span>(=) DINHEIRO CONTADO:</span><span>${money(reg.countedCashCents ?? 0)}</span></div>
        <div class="row bold">
          <span>DIFERENÇA (SOBRA/FALTA):</span>
          <span>${money(reg.differenceCents ?? 0)}</span>
        </div>
        <div class="line"></div>
        <div class="bold">2. VENDAS TOTAIS POR MÉTODO</div>
        ${Object.entries(byMethod)
          .map(
            ([m, d]: [string, any]) =>
              `<div class="row"><span>${m.toUpperCase()} (${d.count}x):</span><span>${money(d.totalCents)}</span></div>`
          )
          .join("")}
        <div class="row bold"><span>TOTAL GERAL VENDAS:</span><span>${money(totals.grandTotalSalesCents)}</span></div>
        <div class="line"></div>
        ${
          movements.length > 0
            ? `<div class="bold">3. MOVIMENTAÇÕES DO TURNO</div>` +
              movements
                .map(
                  (mv: any) =>
                    `<div class="row"><span>${mv.type === "bleed" ? "SANGRIA" : mv.type === "supply" ? "SUPRIMENTO" : "DESPESA"} (${mv.reason}):</span><span>${money(mv.amountCents)}</span></div>`
                )
                .join("") +
              `<div class="line"></div>`
            : ""
        }
        ${reg.notes ? `<div><b>Obs:</b> ${reg.notes}</div><div class="line"></div>` : ""}
        <div class="center" style="margin-top: 15px;">
          <div>_________________________________</div>
          <div>Assinatura do Responsável</div>
        </div>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 250);
  };

  return (
    <div
      style={{
        background: active ? "#f0fdf4" : "#fef2f2",
        border: `1.5px solid ${active ? "#86efac" : "#fca5a5"}`,
        borderRadius: 12,
        padding: "14px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {/* Informações do Caixa */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: active ? "#dcfce7" : "#fee2e2",
            display: "grid",
            placeItems: "center",
            color: active ? "#16a34a" : "#dc2626",
          }}
        >
          <Wallet size={22} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 14, color: active ? "#15803d" : "#991b1b" }}>
              {active ? `Caixa Aberto (Turno #${active.register.id})` : "Caixa Fechado"}
            </strong>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 999,
                background: active ? "#16a34a" : "#dc2626",
                color: "white",
              }}
            >
              {active ? "OPERACIONAL" : "FECHADO"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: active ? "#166534" : "#991b1b" }}>
            {active ? (
              <>
                Operador: <b>{active.register.operatorName}</b> · Aberto às{" "}
                {new Date(active.register.openedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Troco Inicial: <b>{money(active.totals.initialAmountCents)}</b> · Gaveta
                Esperada: <b>{money(active.totals.expectedCashCents)}</b>
              </>
            ) : (
              "É necessário abrir o caixa com o fundo de troco para registrar pagamentos em dinheiro."
            )}
          </span>
        </div>
      </div>

      {/* Botões de Ação do Caixa */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {active ? (
          <>
            <button
              onClick={() => {
                setMovementType("supply");
                setAmountStr("");
                setReasonStr("");
                setModalMode("movement");
              }}
              style={{
                background: "#ffffff",
                border: "1px solid #86efac",
                color: "#15803d",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <ArrowDownCircle size={14} /> Suprimento
            </button>
            <button
              onClick={() => {
                setMovementType("bleed");
                setAmountStr("");
                setReasonStr("");
                setModalMode("movement");
              }}
              style={{
                background: "#ffffff",
                border: "1px solid #fcd34d",
                color: "#b45309",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <ArrowUpCircle size={14} /> Sangria
            </button>
            <button
              onClick={() => printCashSummary(active)}
              style={{
                background: "#ffffff",
                border: "1px solid var(--line)",
                color: "var(--muted)",
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Printer size={14} /> Imprimir Parcial
            </button>
            <button
              onClick={() => {
                setCountedCashStr("");
                setCloseNotes("");
                setModalMode("close");
              }}
              style={{
                background: "#dc2626",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Lock size={14} /> Fechar Caixa
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setAmountStr("100,00");
              setOperatorStr("");
              setModalMode("open");
            }}
            style={{
              background: "#16a34a",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Unlock size={15} /> Abrir Caixa / Turno
          </button>
        )}
      </div>

      {/* Modal Abertura */}
      {modalMode === "open" && (
        <div className="modal-backdrop" onMouseDown={() => setModalMode(null)}>
          <div className="modal-card" style={{ maxWidth: 420 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Controle de Turno</span>
                <h2>Abertura de Caixa</h2>
              </div>
              <button className="icon-button" onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "8px 0 16px" }}>
              Informe o valor inicial disponível para troco (fundo de gaveta) e o nome do atendente/operador.
            </p>
            <label className="field-label">
              Operador Responsável
              <input
                placeholder="Ex.: Carlos / Caixa 1"
                value={operatorStr}
                onChange={(e) => setOperatorStr(e.target.value)}
              />
            </label>
            <label className="field-label">
              Fundo de Troco Inicial (R$)
              <input
                placeholder="Ex.: 100,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </label>
            <Button
              className="primary-button full"
              disabled={openMutation.isPending}
              onClick={() => {
                const cents = parseCents(amountStr);
                openMutation.mutate({
                  initialAmountCents: cents,
                  operatorName: operatorStr.trim() || undefined,
                });
              }}
            >
              {openMutation.isPending ? "Abrindo…" : "Confirmar Abertura"}
            </Button>
          </div>
        </div>
      )}

      {/* Modal Movimentação (Sangria / Suprimento / Despesa) */}
      {modalMode === "movement" && (
        <div className="modal-backdrop" onMouseDown={() => setModalMode(null)}>
          <div className="modal-card" style={{ maxWidth: 440 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Controle de Caixa</span>
                <h2>
                  {movementType === "bleed"
                    ? "Sangria de Caixa"
                    : movementType === "supply"
                    ? "Suprimento / Reforço"
                    : "Despesa Rápida"}
                </h2>
              </div>
              <button className="icon-button" onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              <button
                onClick={() => setMovementType("bleed")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${movementType === "bleed" ? "#b45309" : "var(--line)"}`,
                  background: movementType === "bleed" ? "#fef3c7" : "white",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Sangria (Retirada)
              </button>
              <button
                onClick={() => setMovementType("supply")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${movementType === "supply" ? "#15803d" : "var(--line)"}`,
                  background: movementType === "supply" ? "#dcfce7" : "white",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Suprimento (Entrada)
              </button>
              <button
                onClick={() => setMovementType("expense")}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: `1px solid ${movementType === "expense" ? "#dc2626" : "var(--line)"}`,
                  background: movementType === "expense" ? "#fee2e2" : "white",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Despesa
              </button>
            </div>
            <label className="field-label">
              Valor (R$)
              <input
                placeholder="0,00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </label>
            <label className="field-label">
              Motivo / Justificativa (Obrigatório)
              <input
                placeholder="Ex.: Recolhimento para cofre / Compra de gelo"
                value={reasonStr}
                onChange={(e) => setReasonStr(e.target.value)}
              />
            </label>
            <Button
              className="primary-button full"
              disabled={movementMutation.isPending || !reasonStr.trim()}
              onClick={() => {
                const cents = parseCents(amountStr);
                if (cents <= 0) return alert("Informe um valor válido.");
                movementMutation.mutate({
                  type: movementType,
                  amountCents: cents,
                  reason: reasonStr.trim(),
                });
              }}
            >
              {movementMutation.isPending ? "Registrando…" : "Lançar Movimentação"}
            </Button>
          </div>
        </div>
      )}

      {/* Modal Fechamento de Caixa */}
      {modalMode === "close" && active && (
        <div className="modal-backdrop" onMouseDown={() => setModalMode(null)}>
          <div className="modal-card" style={{ maxWidth: 500 }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">Fechamento do Turno</span>
                <h2>Conferência de Caixa #{active.register.id}</h2>
              </div>
              <button className="icon-button" onClick={() => setModalMode(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Balanço Calculado */}
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                margin: "12px 0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>(+) Fundo Inicial Troco:</span>
                <b>{money(active.totals.initialAmountCents)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>(+) Vendas em Dinheiro:</span>
                <b>{money(active.totals.cashSalesCents)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>(+) Suprimentos:</span>
                <b>{money(active.totals.suppliesCents)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>(-) Sangrias:</span>
                <b>{money(active.totals.bleedsCents)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>(-) Despesas Pagas:</span>
                <b>{money(active.totals.expensesCents)}</b>
              </div>
              <div
                style={{
                  borderTop: "1.5px dashed var(--line)",
                  marginTop: 6,
                  paddingTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  fontWeight: 800,
                  color: "var(--chapa-900)",
                }}
              >
                <span>Esperado na Gaveta:</span>
                <span style={{ color: "var(--brasa)" }}>{money(active.totals.expectedCashCents)}</span>
              </div>
            </div>

            <label className="field-label">
              Valor em Dinheiro Contado na Gaveta (R$)
              <input
                placeholder="Ex.: 450,00"
                value={countedCashStr}
                onChange={(e) => setCountedCashStr(e.target.value)}
                style={{ fontSize: 14, fontWeight: 700 }}
              />
            </label>

            {/* Sobra ou Falta calculada */}
            {countedCashStr && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background:
                    parseCents(countedCashStr) - active.totals.expectedCashCents === 0
                      ? "#f0fdf4"
                      : parseCents(countedCashStr) - active.totals.expectedCashCents > 0
                      ? "#eff6ff"
                      : "#fef2f2",
                  border: `1px solid ${
                    parseCents(countedCashStr) - active.totals.expectedCashCents === 0
                      ? "#86efac"
                      : parseCents(countedCashStr) - active.totals.expectedCashCents > 0
                      ? "#93c5fd"
                      : "#fca5a5"
                  }`,
                }}
              >
                <span>
                  {parseCents(countedCashStr) - active.totals.expectedCashCents === 0 ? (
                    <b style={{ color: "#166534" }}>✓ Caixa bateu perfeitamente!</b>
                  ) : parseCents(countedCashStr) - active.totals.expectedCashCents > 0 ? (
                    <span style={{ color: "#1e40af" }}>Sobra de Caixa:</span>
                  ) : (
                    <span style={{ color: "#991b1b" }}>Falta de Caixa:</span>
                  )}
                </span>
                <strong style={{ fontSize: 14 }}>
                  {money(parseCents(countedCashStr) - active.totals.expectedCashCents)}
                </strong>
              </div>
            )}

            <label className="field-label">
              Observações do Fechamento
              <textarea
                rows={2}
                placeholder="Ex.: Sangria final enviada ao malote..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </label>

            <Button
              className="primary-button full"
              disabled={closeMutation.isPending || !countedCashStr}
              onClick={() => {
                closeMutation.mutate({
                  countedCashCents: parseCents(countedCashStr),
                  notes: closeNotes.trim() || undefined,
                });
              }}
            >
              {closeMutation.isPending ? "Encerrando…" : "Fechar Caixa e Emitir Comprovante"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { X, Plus, Trash2, Check, AlertCircle, Wallet } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface OrderProps {
  code: string;
  totalCents: number;
  paidCents?: number;
  financialStatus?: string;
  tableName?: string | null;
  customerName?: string | null;
  items?: unknown;
}

interface SplitItem {
  id: string;
  method: "pix" | "credito" | "debito" | "dinheiro" | "vale_refeicao";
  amountInput: string;
  receivedInput: string;
  cardBrand: string;
  receiptRef: string;
}

interface Props {
  order: OrderProps;
  onClose: () => void;
  onSuccess: () => void;
  isOpenCashRegister: boolean;
  onOpenCashPrompt?: () => void;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  dinheiro: "Dinheiro (em espécie)",
  vale_refeicao: "Vale Refeição (VR)",
};

export function ReceivePaymentModal({
  order,
  onClose,
  onSuccess,
  isOpenCashRegister,
  onOpenCashPrompt,
}: Props) {
  const alreadyPaid = order.paidCents || 0;
  const balanceDue = Math.max(0, order.totalCents - alreadyPaid);

  const [splits, setSplits] = useState<SplitItem[]>([
    {
      id: "1",
      method: "pix",
      amountInput: (balanceDue / 100).toFixed(2).replace(".", ","),
      receivedInput: "",
      cardBrand: "",
      receiptRef: "",
    },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parseCents = (val: string): number => {
    if (!val) return 0;
    const clean = val.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num * 100);
  };

  const totalPayingCents = splits.reduce((sum, s) => sum + parseCents(s.amountInput), 0);
  const remainingCents = balanceDue - totalPayingCents;

  const addSplit = () => {
    const rem = Math.max(0, remainingCents);
    setSplits((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        method: "dinheiro",
        amountInput: rem > 0 ? (rem / 100).toFixed(2).replace(".", ",") : "0,00",
        receivedInput: "",
        cardBrand: "",
        receiptRef: "",
      },
    ]);
  };

  const removeSplit = (id: string) => {
    if (splits.length === 1) return;
    setSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const updateSplit = (id: string, field: keyof SplitItem, value: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const createPaymentMutation = trpc.payments.create.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = (allowPartial = false) => {
    setErrorMsg(null);

    // Validate methods & amounts
    for (const split of splits) {
      const amt = parseCents(split.amountInput);
      if (amt <= 0) {
        setErrorMsg("Todos os pagamentos adicionados precisam ter valor maior que zero.");
        return;
      }
      if (split.method === "dinheiro") {
        if (!isOpenCashRegister) {
          setErrorMsg(
            "Atenção: Não é possível receber em dinheiro sem um caixa aberto. Abra o caixa antes."
          );
          return;
        }
        const rec = parseCents(split.receivedInput);
        if (rec > 0 && rec < amt) {
          setErrorMsg("Valor entregue em dinheiro não pode ser menor que o valor a pagar.");
          return;
        }
      }
    }

    if (totalPayingCents > balanceDue) {
      setErrorMsg("A soma dos pagamentos não pode ser superior ao saldo devedor.");
      return;
    }

    if (totalPayingCents < balanceDue && !allowPartial) {
      setErrorMsg(
        `Faltam ${money(remainingCents)} para quitar a conta. Para salvar o que já foi recebido, use "Registrar Pagamento Parcial".`
      );
      return;
    }

    const items = splits.map((s) => {
      const amt = parseCents(s.amountInput);
      const rec = s.method === "dinheiro" && s.receivedInput ? parseCents(s.receivedInput) : amt;
      const chg = s.method === "dinheiro" && rec > amt ? rec - amt : 0;
      return {
        method: s.method,
        amountCents: amt,
        receivedCents: rec,
        changeCents: chg,
        cardBrand: s.cardBrand.trim() || undefined,
        receiptRef: s.receiptRef.trim() || undefined,
      };
    });

    createPaymentMutation.mutate({
      orderCode: order.code,
      items,
    });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 560, width: "95%" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow">Baixa da Comanda</span>
            <h2>Receber Pagamento</h2>
            <small style={{ color: "var(--muted)" }}>
              Pedido #{order.code} {order.tableName ? `· ${order.tableName}` : ""}{" "}
              {order.customerName ? `· ${order.customerName}` : ""}
            </small>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Resumo de Valores */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            background: "#fff9f0",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 14,
            margin: "12px 0",
            textAlign: "center",
          }}
        >
          <div>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
              Total Pedido
            </span>
            <strong style={{ display: "block", fontSize: 16, color: "var(--chapa-900)" }}>
              {money(order.totalCents)}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
              Já Pago
            </span>
            <strong style={{ display: "block", fontSize: 16, color: "#16a34a" }}>
              {money(alreadyPaid)}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>
              Saldo Devedor
            </span>
            <strong style={{ display: "block", fontSize: 16, color: "var(--brasa)" }}>
              {money(balanceDue)}
            </strong>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 8,
              padding: "10px 12px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={16} />
            <div style={{ flex: 1 }}>{errorMsg}</div>
            {!isOpenCashRegister && onOpenCashPrompt && (
              <button
                onClick={onOpenCashPrompt}
                style={{
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Abrir Caixa
              </button>
            )}
          </div>
        )}

        {/* Linhas de Pagamento */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 320, overflowY: "auto" }}>
          {splits.map((split, index) => {
            const amt = parseCents(split.amountInput);
            const rec = parseCents(split.receivedInput);
            const troco = split.method === "dinheiro" && rec > amt ? rec - amt : 0;

            return (
              <div
                key={split.id}
                style={{
                  background: "white",
                  border: "1.5px solid var(--line)",
                  borderRadius: 10,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--muted)" }}>
                    Forma #{index + 1}
                  </span>
                  {splits.length > 1 && (
                    <button
                      onClick={() => removeSplit(split.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                      }}
                    >
                      <Trash2 size={13} /> Remover
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
                  <label className="field-label" style={{ margin: 0 }}>
                    Forma de Pagamento
                    <select
                      value={split.method}
                      onChange={(e) =>
                        updateSplit(split.id, "method", e.target.value as SplitItem["method"])
                      }
                      style={{ fontSize: 13 }}
                    >
                      {Object.entries(METHOD_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-label" style={{ margin: 0 }}>
                    Valor a Pagar (R$)
                    <input
                      type="text"
                      value={split.amountInput}
                      onChange={(e) => updateSplit(split.id, "amountInput", e.target.value)}
                      placeholder="0,00"
                      style={{ fontSize: 13, fontWeight: 700, color: "var(--chapa-900)" }}
                    />
                  </label>
                </div>

                {/* Campos extras para Dinheiro */}
                {split.method === "dinheiro" && (
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 8,
                      padding: "8px 10px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <label style={{ fontSize: 11, color: "#166534" }}>
                      Valor Entregue pelo Cliente:
                      <input
                        type="text"
                        value={split.receivedInput}
                        onChange={(e) => updateSplit(split.id, "receivedInput", e.target.value)}
                        placeholder="Ex.: 50,00"
                        style={{
                          marginTop: 4,
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #86efac",
                          fontSize: 12,
                          width: "100%",
                          background: "white",
                        }}
                      />
                    </label>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 10, color: "#166534", textTransform: "uppercase" }}>
                        Troco a Devolver:
                      </span>
                      <strong
                        style={{
                          display: "block",
                          fontSize: 16,
                          color: troco > 0 ? "#15803d" : "#64748b",
                        }}
                      >
                        {money(troco)}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Campos opcionais para Cartão */}
                {["credito", "debito", "vale_refeicao"].includes(split.method) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input
                      placeholder="Bandeira / Maquininha (opcional)"
                      value={split.cardBrand}
                      onChange={(e) => updateSplit(split.id, "cardBrand", e.target.value)}
                      style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                    />
                    <input
                      placeholder="NSU / Comprovante (opcional)"
                      value={split.receiptRef}
                      onChange={(e) => updateSplit(split.id, "receiptRef", e.target.value)}
                      style={{ fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--line)" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Botão de Adicionar Mais Formas (Dividir Conta) */}
        {remainingCents > 0 && (
          <button
            onClick={addSplit}
            style={{
              marginTop: 10,
              background: "#fffaf0",
              border: "1.5px dashed var(--line)",
              borderRadius: 8,
              padding: "8px 12px",
              width: "100%",
              color: "var(--chapa-900)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Plus size={15} /> Dividir conta / Adicionar outra forma de pagamento
          </button>
        )}

        {/* Status do Fechamento */}
        <div
          style={{
            margin: "14px 0 10px",
            padding: 10,
            borderRadius: 8,
            background: remainingCents === 0 ? "#ecfdf5" : remainingCents > 0 ? "#fffbeb" : "#fef2f2",
            border: `1px solid ${remainingCents === 0 ? "#a7f3d0" : remainingCents > 0 ? "#fde68a" : "#fca5a5"}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
          }}
        >
          <span>
            {remainingCents === 0 ? (
              <b style={{ color: "#065f46" }}>✓ Totalmente liquidado</b>
            ) : remainingCents > 0 ? (
              <span style={{ color: "#92400e" }}>Restante a acertar: <b>{money(remainingCents)}</b></span>
            ) : (
              <span style={{ color: "#991b1b" }}>Valor excedente: <b>{money(Math.abs(remainingCents))}</b></span>
            )}
          </span>
          <strong style={{ fontSize: 14 }}>Total lançado: {money(totalPayingCents)}</strong>
        </div>

        {/* Ações */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          {remainingCents > 0 && totalPayingCents > 0 && (
            <Button
              className="secondary-button"
              style={{ flex: 1 }}
              disabled={createPaymentMutation.isPending}
              onClick={() => handleSubmit(true)}
            >
              Registrar Parcial
            </Button>
          )}

          <Button
            className="primary-button"
            style={{ flex: 2 }}
            disabled={createPaymentMutation.isPending || totalPayingCents <= 0 || remainingCents < 0}
            onClick={() => handleSubmit(false)}
          >
            {createPaymentMutation.isPending ? "Processando…" : "Concluir Pagamento"} <Check size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

interface Props {
  type: "cancel_order" | "refund_payment";
  idOrCode: string | number;
  title: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CancelRefundModal({
  type,
  idOrCode,
  title,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cancelOrderMutation = trpc.orders.cancel.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const refundPaymentMutation = trpc.payments.refund.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const isPending =
    cancelOrderMutation.isPending || refundPaymentMutation.isPending;

  const handleSubmit = () => {
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("A justificativa é obrigatória (mínimo de 3 caracteres).");
      return;
    }
    setErrorMsg(null);

    if (type === "cancel_order") {
      cancelOrderMutation.mutate({
        code: String(idOrCode),
        reason: reason.trim(),
      });
    } else {
      refundPaymentMutation.mutate({
        paymentId: Number(idOrCode),
        reason: reason.trim(),
      });
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 460 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ color: "#dc2626" }}>
              Ação Administrativa / Auditoria
            </span>
            <h2>{type === "cancel_order" ? "Cancelar Pedido" : "Estornar Pagamento"}</h2>
            <small style={{ color: "var(--muted)" }}>{title}</small>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            color: "#9f1239",
            display: "flex",
            alignItems: "center",
            gap: 8,
            margin: "12px 0",
          }}
        >
          <AlertTriangle size={18} />
          <span>
            Esta ação ficará registrada no <b>log de auditoria</b> com sua identificação,
            data/hora e motivo. O registro original é preservado.
          </span>
        </div>

        {errorMsg && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            {errorMsg}
          </div>
        )}

        <label className="field-label">
          Motivo / Justificativa (Obrigatório)
          <textarea
            rows={3}
            placeholder="Ex.: Cliente desistiu antes do preparo / Erro de digitação no valor da maquininha..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <Button className="secondary-button" style={{ flex: 1 }} onClick={onClose}>
            Voltar
          </Button>
          <Button
            className="primary-button"
            style={{ flex: 1.5, background: "#dc2626", borderColor: "#dc2626" }}
            disabled={isPending || !reason.trim()}
            onClick={handleSubmit}
          >
            {isPending
              ? "Processando…"
              : type === "cancel_order"
              ? "Confirmar Cancelamento"
              : "Confirmar Estorno"}
          </Button>
        </div>
      </div>
    </div>
  );
}

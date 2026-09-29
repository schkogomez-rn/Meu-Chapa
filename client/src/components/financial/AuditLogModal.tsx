import React from "react";
import { X, ShieldAlert, History } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  payment_created: "Pagamento Registrado",
  payment_refunded: "Estorno de Pagamento",
  order_cancelled: "Pedido Cancelado",
  cash_register_opened: "Abertura de Caixa",
  cash_register_closed: "Fechamento de Caixa",
  cash_movement_bleed: "Sangria Realizada",
  cash_movement_supply: "Suprimento Inserido",
  cash_movement_expense: "Despesa Lançada",
};

export function AuditLogModal({ onClose }: Props) {
  const auditQuery = trpc.audit.list.useQuery();
  const logs = auditQuery.data || [];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 760, width: "95%" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <span className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <ShieldAlert size={14} color="#b45309" /> Trilha de Conformidade
            </span>
            <h2>Log de Auditoria da Casa</h2>
            <small style={{ color: "var(--muted)" }}>
              Registro cronológico de cancelamentos, estornos, movimentações e fechamentos.
            </small>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: 440, overflowY: "auto", margin: "14px 0" }}>
          {auditQuery.isLoading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              Carregando auditoria…
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
              Nenhum evento registrado ainda.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "#f8fafc" }}>
                <tr style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: 10 }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Data / Hora</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Ação</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Entidade</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Responsável</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Justificativa / Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px", whiteSpace: "nowrap", color: "var(--muted)" }}>
                      {new Date(l.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "8px", fontWeight: 700 }}>
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 10,
                          background: l.action.includes("refund") || l.action.includes("cancel")
                            ? "#fee2e2"
                            : l.action.includes("bleed")
                            ? "#fef3c7"
                            : "#dcfce7",
                          color: l.action.includes("refund") || l.action.includes("cancel")
                            ? "#991b1b"
                            : l.action.includes("bleed")
                            ? "#92400e"
                            : "#166534",
                        }}
                      >
                        {ACTION_LABELS[l.action] || l.action}
                      </span>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <span style={{ color: "var(--chapa-900)", fontWeight: 600 }}>
                        {l.entity} #{l.entityId}
                      </span>
                    </td>
                    <td style={{ padding: "8px", color: "var(--chapa-900)" }}>{l.user}</td>
                    <td style={{ padding: "8px", color: "var(--muted)" }}>
                      {Boolean(l.reason) && (
                        <div style={{ color: "#b91c1c", fontWeight: 500 }}>“{String(l.reason)}”</div>
                      )}
                      {Boolean(l.details) && (
                        <code style={{ fontSize: 10, background: "#f1f5f9", padding: "2px 4px", borderRadius: 4 }}>
                          {JSON.stringify(l.details)}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

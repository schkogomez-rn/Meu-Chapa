import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  ChefHat,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  Flame,
  LockKeyhole,
  Minus,
  MonitorSmartphone,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/design-system/BrandHeader";
import { BrandFooter } from "@/components/design-system/BrandFooter";
import { PillSelector, type PillTab } from "@/components/design-system/PillSelector";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { formatDateTime, formatMoney, formatTimeOnly } from "@/components/design-system/Formatters";
import { ReceivePaymentModal } from "@/components/financial/ReceivePaymentModal";
import { CashRegisterControl } from "@/components/financial/CashRegisterControl";
import { CancelRefundModal } from "@/components/financial/CancelRefundModal";
import { AuditLogModal } from "@/components/financial/AuditLogModal";
import { StaffUsersManager } from "./StaffUsersManager";
import { TableQRManager } from "./TableQRManager";

type OpsTab = "orders" | "financial" | "reports" | "users" | "tables";
type StatsPeriod = "day" | "week" | "month" | "year";

interface PaymentItem {
  id: number;
  orderCode: string;
  method: string;
  amountCents: number;
  receivedCents?: number | null;
  changeCents?: number | null;
  cardBrand?: string | null;
  receiptRef?: string | null;
  status: string;
  operatorName?: string | null;
  createdAt: string | Date;
}

interface StoredOrder {
  code: string;
  origin: string;
  serviceMode: string;
  tableName: string | null;
  customerName: string | null;
  paymentMethod: string;
  notes: string | null;
  items: unknown;
  totalCents: number;
  paidCents?: number;
  status: "pending_waiter" | "received" | "preparing" | "ready" | "completed" | "cancelled";
  financialStatus?: "pending" | "partial" | "paid" | "refunded" | "cancelled";
  operatorName?: string | null;
  createdAt: string | Date;
  payments?: PaymentItem[];
}

const PIE_COLORS = ["#ffc400", "#f07b17", "#5c823b", "#3b82f6", "#d97706", "#8b5cf6", "#ef4444"];

export function OperationsPanel({ onBack }: { onBack: () => void }) {
  const staffMe = trpc.staffAuth.me.useQuery();
  const staffUser = staffMe.data;
  const userRole = staffUser?.role || "garcom";
  const isMaster = userRole === "master" || userRole === "dono";
  const isAdmin = isMaster || userRole === "administrador" || userRole === "gerente";
  const isCashier = isAdmin || userRole === "caixa";
  const isWaiter = isAdmin || userRole === "garcom";

  const [tab, setTab] = useState<OpsTab>("orders");
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>("day");
  const [receivingOrder, setReceivingOrder] = useState<StoredOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<StoredOrder | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Queries
  const ordersQuery = trpc.orders.list.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const activeCashQuery = trpc.cash.getActive.useQuery(undefined, {
    enabled: Boolean(staffUser && isCashier),
  });
  const statsQuery = trpc.orders.stats.useQuery(
    { period: statsPeriod },
    { enabled: Boolean(tab === "reports" && staffUser && isAdmin) }
  );

  const statusMutation = trpc.orders.setStatus.useMutation({
    onSuccess: () => ordersQuery.refetch(),
    onError: (err) => alert(err.message),
  });

  const orders = (ordersQuery.data ?? []) as unknown as StoredOrder[];

  // Determine allowed tabs by role
  const availableTabs: PillTab<OpsTab>[] = [
    {
      id: "orders",
      label: "Esteira da Chapa (KDS)",
      icon: <Flame size={15} />,
      badge: orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
    },
  ];

  if (isCashier) {
    availableTabs.push({
      id: "financial",
      label: "Financeiro & Caixa",
      icon: <CircleDollarSign size={15} />,
    });
  }

  if (isAdmin) {
    availableTabs.push({
      id: "reports",
      label: "Relatórios & DRE",
      icon: <TrendingUp size={15} />,
    });
    availableTabs.push({
      id: "users",
      label: isMaster ? "👑 Equipe & Acessos (Master)" : "🛡️ Equipe & Acessos",
      icon: <Users size={15} />,
    });
  }

  if (isWaiter) {
    availableTabs.push({
      id: "tables",
      label: "Mesas & QR Codes",
      icon: <QrCode size={15} />,
    });
  }

  const isKitchenOnly = userRole === "cozinha";
  const columns = [
    ...(!isKitchenOnly
      ? [{ status: "pending_waiter" as const, label: "Aguardando Garçom", icon: <Clock3 size={16} /> }]
      : []),
    { status: "received" as const, label: "Recebidos na Chapa", icon: <Flame size={16} /> },
    { status: "preparing" as const, label: "Na Chapa", icon: <Flame size={16} /> },
    { status: "ready" as const, label: "Prontos para Sair", icon: <Check size={16} /> },
  ];

  const handleAdvanceStatus = (order: StoredOrder, targetStatus: StoredOrder["status"]) => {
    if (targetStatus === "completed" && order.serviceMode === "counter" && order.financialStatus !== "paid") {
      alert("Atenção: Pedido de balcão precisa estar quitado antes de ser entregue.");
      setReceivingOrder(order);
      return;
    }
    statusMutation.mutate({ code: order.code, status: targetStatus });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0604", color: "#fff8eb", display: "flex", flexDirection: "column" }}>
      {/* Brand Header with staff credentials */}
      <BrandHeader
        subtitle={
          isMaster
            ? "👑 MODO MASTER • CONTROLE TOTAL DO SISTEMA"
            : isAdmin
            ? "🛡️ MODO ADMINISTRADOR • GESTÃO E OPERAÇÕES"
            : `Painel da Operação • Perfil: ${userRole.toUpperCase()}`
        }
        onBack={onBack}
        compact
      />

      {/* Control bar with Tabs and KPIs */}
      <div
        style={{
          background: "linear-gradient(180deg, rgba(28, 14, 8, 0.95), rgba(16, 8, 5, 0.98))",
          borderBottom: "1px solid rgba(255, 196, 0, 0.2)",
          padding: "16px clamp(16px, 4vw, 36px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <PillSelector tabs={availableTabs} activeTab={tab} onChange={setTab} />

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 196, 0, 0.25)",
                color: "#ffd44c",
                borderRadius: "8px",
                padding: "7px 12px",
                fontSize: "11px",
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              <ShieldAlert size={14} /> Log de Auditoria
            </button>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "11px",
              color: "#d6be9f",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
            <span>Tempo real ativo</span>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <main style={{ flex: 1, padding: "24px clamp(16px, 4vw, 36px)", maxWidth: "1400px", margin: "0 auto", width: "100%" }}>
        
        {/* ═════════════════════════════════════════════════════════════════════
            TAB 1: ESTEIRA DA CHAPA (KDS)
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "orders" && (
          <div>
            {/* KPI Strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(255, 196, 0, 0.2)", borderRadius: "12px", padding: "14px 18px" }}>
                <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>
                  Pedidos em Aberto
                </span>
                <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "28px", color: "var(--cheddar)", marginTop: "2px" }}>
                  {orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length}
                </strong>
              </div>
              <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(240, 123, 23, 0.3)", borderRadius: "12px", padding: "14px 18px" }}>
                <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>
                  Na Chapa Agora
                </span>
                <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "28px", color: "#ff9838", marginTop: "2px" }}>
                  {orders.filter((o) => o.status === "preparing").length}
                </strong>
              </div>
              {userRole !== "cozinha" && (
                <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(255, 196, 0, 0.2)", borderRadius: "12px", padding: "14px 18px" }}>
                  <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>
                    Faturamento Hoje
                  </span>
                  <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "28px", color: "#86efac", marginTop: "2px" }}>
                    {formatMoney(orders.reduce((sum, o) => sum + (o.paidCents || 0), 0))}
                  </strong>
                </div>
              )}
            </div>

            {/* KDS Columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
              {columns.map((col) => {
                const colOrders = orders.filter((o) => o.status === col.status);
                return (
                  <div
                    key={col.status}
                    style={{
                      background: "rgba(22, 11, 7, 0.8)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "16px",
                      padding: "16px",
                      minHeight: "480px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "var(--cheddar)" }}>{col.icon}</span>
                        <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", textTransform: "uppercase", margin: 0, color: "#fff" }}>
                          {col.label}
                        </h3>
                      </div>
                      <span style={{ background: "rgba(255, 196, 0, 0.2)", color: "#ffd44c", borderRadius: "999px", padding: "2px 8px", fontSize: "11px", fontWeight: 800 }}>
                        {colOrders.length}
                      </span>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
                      {colOrders.length === 0 ? (
                        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#6e5a47", fontSize: "12px", border: "1px dashed rgba(255,255,255,0.06)", borderRadius: "10px", padding: "20px" }}>
                          Nenhum pedido nesta fase
                        </div>
                      ) : (
                        colOrders.map((order) => {
                          const items = (Array.isArray(order.items) ? order.items : []) as any[];
                          return (
                            <div
                              key={order.code}
                              style={{
                                background: "linear-gradient(160deg, rgba(38, 20, 12, 0.95), rgba(22, 11, 7, 0.98))",
                                border: "1px solid rgba(255, 196, 0, 0.2)",
                                borderLeft: "4px solid var(--brasa)",
                                borderRadius: "12px",
                                padding: "14px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "10px",
                                boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#fff" }}>
                                    #{order.code}
                                  </strong>
                                  <span style={{ display: "block", fontSize: "11px", color: "var(--cheddar)" }}>
                                    {order.tableName || order.origin} {order.customerName ? `• ${order.customerName}` : ""}
                                  </span>
                                </div>
                                <span style={{ fontSize: "10px", color: "#a8947f" }}>
                                  {formatTimeOnly(order.createdAt)}
                                </span>
                              </div>

                              {/* Items list */}
                              <div style={{ fontSize: "12px", lineHeight: 1.5, borderTop: "1px dashed rgba(255,255,255,0.08)", paddingTop: "8px" }}>
                                {items.map((i, idx) => (
                                  <div key={idx} style={{ marginBottom: "4px" }}>
                                    <span style={{ color: "var(--cheddar)", fontWeight: 800 }}>{i.quantity}x</span>{" "}
                                    <strong style={{ color: "#fff" }}>{i.name}</strong>
                                    {i.observation && (
                                      <small style={{ display: "block", color: "#fca5a5", paddingLeft: "16px", fontStyle: "italic" }}>
                                        Obs: {i.observation}
                                      </small>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {order.notes && (
                                <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "6px 8px", fontSize: "11px", color: "#d6be9f" }}>
                                  Nota: {order.notes}
                                </div>
                              )}

                              {/* Footer & Actions */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                {userRole !== "cozinha" ? (
                                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "16px", color: "#ffd44c" }}>
                                    {formatMoney(order.totalCents)}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "11px", color: "#a8947f" }}>
                                    {items.reduce((s, i) => s + (i.quantity || 1), 0)} itens
                                  </span>
                                )}

                                <div style={{ display: "flex", gap: "6px" }}>
                                  {order.status === "pending_waiter" && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceStatus(order, "received")}
                                      style={{
                                        background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                        color: "#fff",
                                        border: 0,
                                        borderRadius: "6px",
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        boxShadow: "0 2px 10px rgba(34, 197, 94, 0.4)",
                                      }}
                                    >
                                      <Check size={13} /> Validar p/ Chapa →
                                    </button>
                                  )}
                                  {order.status === "received" && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceStatus(order, "preparing")}
                                      style={{
                                        background: "linear-gradient(135deg, #ffc400, #f07b17)",
                                        color: "#120704",
                                        border: 0,
                                        borderRadius: "6px",
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Para a Chapa →
                                    </button>
                                  )}
                                  {order.status === "preparing" && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceStatus(order, "ready")}
                                      style={{
                                        background: "#22c55e",
                                        color: "#052e16",
                                        border: 0,
                                        borderRadius: "6px",
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Pronto ✓
                                    </button>
                                  )}
                                  {order.status === "ready" && (
                                    <button
                                      type="button"
                                      onClick={() => handleAdvanceStatus(order, "completed")}
                                      style={{
                                        background: "rgba(255,255,255,0.1)",
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        color: "#86efac",
                                        borderRadius: "6px",
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Entregue
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 2: FINANCEIRO & CAIXA
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "financial" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <CashRegisterControl />
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 3: RELATÓRIOS
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "reports" && statsQuery.data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "#fff", margin: 0, textTransform: "uppercase" }}>
                Relatório de Vendas & DRE
              </h2>
              <div style={{ display: "flex", gap: "6px" }}>
                {(["day", "week", "month", "year"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setStatsPeriod(p)}
                    style={{
                      background: statsPeriod === p ? "var(--cheddar)" : "rgba(255, 255, 255, 0.08)",
                      color: statsPeriod === p ? "#120704" : "#d6be9f",
                      border: 0,
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "11px",
                      fontWeight: 750,
                      cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >
                    {p === "day" ? "Hoje" : p === "week" ? "Semana" : p === "month" ? "Mês" : "Ano"}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(255, 196, 0, 0.25)", borderRadius: "14px", padding: "16px 20px" }}>
                <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>Total de Pedidos</span>
                <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "32px", color: "#fff", marginTop: "4px" }}>
                  {statsQuery.data.totals.orders}
                </strong>
              </div>
              <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(255, 196, 0, 0.25)", borderRadius: "14px", padding: "16px 20px" }}>
                <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>Receita Total</span>
                <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "32px", color: "#86efac", marginTop: "4px" }}>
                  {formatMoney(statsQuery.data.totals.revenue)}
                </strong>
              </div>
              <div style={{ background: "rgba(32, 17, 10, 0.9)", border: "1px solid rgba(255, 196, 0, 0.25)", borderRadius: "14px", padding: "16px 20px" }}>
                <span style={{ fontSize: "11px", color: "#a8947f", textTransform: "uppercase", fontWeight: 750 }}>Ticket Médio</span>
                <strong style={{ display: "block", fontFamily: "Oswald, sans-serif", fontSize: "32px", color: "var(--cheddar)", marginTop: "4px" }}>
                  {formatMoney(statsQuery.data.totals.avgTicket)}
                </strong>
              </div>
            </div>

            {/* Top Items Table */}
            <div style={{ background: "rgba(32, 17, 10, 0.95)", border: "1px solid rgba(255, 196, 0, 0.22)", borderRadius: "16px", padding: "20px" }}>
              <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#fff", textTransform: "uppercase", margin: "0 0 14px" }}>
                Mais Vendidos na Chapa
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {statsQuery.data.topItems.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,196,0,0.2)", color: "#ffd44c", display: "grid", placeItems: "center", fontSize: "11px", fontWeight: 800 }}>
                        {idx + 1}
                      </span>
                      <strong style={{ color: "#fff", fontSize: "13px" }}>{item.name}</strong>
                    </div>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "12px" }}>
                      <span style={{ color: "#d6be9f" }}>{item.qty} un</span>
                      <strong style={{ color: "#ffd44c" }}>{formatMoney(item.revenue)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 4: EQUIPE & ACESSOS
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "users" && <StaffUsersManager />}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 5: MESAS & QR CODES
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "tables" && <TableQRManager />}

      </main>

      {/* Financial modals */}
      {receivingOrder && (
        <ReceivePaymentModal
          order={receivingOrder as any}
          isOpenCashRegister={Boolean(activeCashQuery.data)}
          onClose={() => setReceivingOrder(null)}
          onSuccess={() => {
            setReceivingOrder(null);
            ordersQuery.refetch();
          }}
        />
      )}

      {cancellingOrder && (
        <CancelRefundModal
          type="cancel_order"
          idOrCode={cancellingOrder.code}
          title={`Cancelar Pedido #${cancellingOrder.code}`}
          onClose={() => setCancellingOrder(null)}
          onSuccess={() => {
            setCancellingOrder(null);
            ordersQuery.refetch();
          }}
        />
      )}

      {isAuditModalOpen && <AuditLogModal onClose={() => setIsAuditModalOpen(false)} />}

      <BrandFooter />
    </div>
  );
}

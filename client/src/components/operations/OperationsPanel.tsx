import React, { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  BarChart3,
  Check,
  CheckCircle2,
  ChefHat,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileSpreadsheet,
  Flame,
  LockKeyhole,
  Minus,
  MonitorSmartphone,
  PencilLine,
  Plus,
  Printer,
  QrCode,
  Receipt,
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
import { EditOrderModal } from "./EditOrderModal";

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

function getPaymentMethodDisplay(methodStr: string, brand?: string | null) {
  const m = (methodStr || "").toLowerCase();
  if (m.includes("pix")) {
    return {
      label: "Pix",
      icon: "💠",
      color: "#34d399",
      bg: "rgba(16, 185, 129, 0.15)",
      border: "rgba(16, 185, 129, 0.4)",
    };
  }
  if (m.includes("crédito") || m.includes("credito")) {
    return {
      label: brand ? `Crédito (${brand})` : "Cartão de Crédito",
      icon: "💳",
      color: "#fbbf24",
      bg: "rgba(245, 158, 11, 0.15)",
      border: "rgba(245, 158, 11, 0.4)",
    };
  }
  if (m.includes("débito") || m.includes("debito")) {
    return {
      label: "Cartão de Débito",
      icon: "💳",
      color: "#60a5fa",
      bg: "rgba(59, 130, 246, 0.15)",
      border: "rgba(59, 130, 246, 0.4)",
    };
  }
  if (m.includes("dinheiro")) {
    return {
      label: "Dinheiro",
      icon: "💵",
      color: "#4ade80",
      bg: "rgba(34, 197, 94, 0.15)",
      border: "rgba(34, 197, 94, 0.4)",
    };
  }
  if (m.includes("vale") || m.includes("refei") || m.includes("vr")) {
    return {
      label: "Vale Refeição (VR)",
      icon: "🎟️",
      color: "#a78bfa",
      bg: "rgba(139, 92, 246, 0.15)",
      border: "rgba(139, 92, 246, 0.4)",
    };
  }
  return {
    label: methodStr || "Outro",
    icon: "💳",
    color: "#ffd44c",
    bg: "rgba(255, 196, 0, 0.15)",
    border: "rgba(255, 196, 0, 0.4)",
  };
}

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
  const [editingOrder, setEditingOrder] = useState<StoredOrder | null>(null);
  const canEditOrders = isWaiter || isCashier;
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

  const unpaidReadyOrDelivered = orders.filter(
    (o) => (o.status === "ready" || o.status === "completed") && o.financialStatus !== "paid"
  );
  const paidOrders = orders.filter(
    (o) => o.financialStatus === "paid" || (o.paidCents || 0) > 0 || (o.payments && o.payments.length > 0)
  );

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
      badge: unpaidReadyOrDelivered.length > 0 ? unpaidReadyOrDelivered.length : undefined,
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
    if (targetStatus === "completed" && order.financialStatus !== "paid") {
      const confirmDeliver = window.confirm(
        `O pedido #${order.code} ainda não foi marcado como pago.\n\nDeseja registrar o pagamento na entrega agora? (Clique em 'OK' para abrir o recebimento ou 'Cancelar' para apenas concluir a entrega)`
      );
      if (confirmDeliver) {
        setReceivingOrder(order);
        return;
      }
    }
    statusMutation.mutate({ code: order.code, status: targetStatus });
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column" }}>
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

                              {/* Indicação de pagamento: apenas no pedido pronto ou entregue */}
                              {(order.status === "ready" || (order.status as string) === "completed") && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    background:
                                      order.financialStatus === "paid"
                                        ? "rgba(34, 197, 94, 0.15)"
                                        : "rgba(245, 158, 11, 0.15)",
                                    border: `1px solid ${
                                      order.financialStatus === "paid"
                                        ? "rgba(34, 197, 94, 0.35)"
                                        : "rgba(245, 158, 11, 0.35)"
                                    }`,
                                    borderRadius: "8px",
                                    padding: "6px 10px",
                                    fontSize: "11px",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: order.financialStatus === "paid" ? "#86efac" : "#fef08a",
                                      fontWeight: 750,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "5px",
                                    }}
                                  >
                                    💳 {order.financialStatus === "paid"
                                      ? `Pago: ${order.paymentMethod}`
                                      : "Pagamento na entrega: Pendente"}
                                  </span>
                                  {order.financialStatus !== "paid" && isCashier && (
                                    <button
                                      type="button"
                                      onClick={() => setReceivingOrder(order)}
                                      style={{
                                        background: "#16a34a",
                                        color: "#fff",
                                        border: 0,
                                        borderRadius: "6px",
                                        padding: "3px 8px",
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Receber / Baixa
                                    </button>
                                  )}
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
                                  {canEditOrders && order.status !== "completed" && order.status !== "cancelled" && (
                                    <button
                                      type="button"
                                      id={`edit-order-${order.code}`}
                                      title="Editar itens do pedido"
                                      onClick={() => setEditingOrder(order)}
                                      style={{
                                        background: "rgba(255, 196, 0, 0.1)",
                                        border: "1px solid rgba(255, 196, 0, 0.35)",
                                        color: "#ffd44c",
                                        borderRadius: "6px",
                                        padding: "6px 10px",
                                        fontSize: "11px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      <PencilLine size={13} /> Editar
                                    </button>
                                  )}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* Bloco 1: Abertura, Sangrias, Suprimentos e Fechamento de Caixa */}
            <CashRegisterControl onRefreshNeeded={() => ordersQuery.refetch()} />

            {/* Bloco 2: Pedidos Prontos para Entrega Sem Pagamento */}
            <div
              style={{
                background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(20, 10, 6, 0.98))",
                border: unpaidReadyOrDelivered.length > 0 ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid rgba(255, 196, 0, 0.22)",
                borderRadius: "16px",
                padding: "20px 24px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: unpaidReadyOrDelivered.length > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                      color: unpaidReadyOrDelivered.length > 0 ? "#ef4444" : "#22c55e",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Clock3 size={20} />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: "20px",
                        color: "#fff",
                        textTransform: "uppercase",
                        margin: 0,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Pedidos Prontos para Entrega • Aguardando Pagamento
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a8947f" }}>
                      Pedidos finalizados na chapa ou já entregues que ainda necessitam da baixa do pagamento.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: unpaidReadyOrDelivered.length > 0 ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                      color: unpaidReadyOrDelivered.length > 0 ? "#fca5a5" : "#86efac",
                      border: `1px solid ${unpaidReadyOrDelivered.length > 0 ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,
                      borderRadius: "999px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {unpaidReadyOrDelivered.length} a cobrar
                  </span>
                  {unpaidReadyOrDelivered.length > 0 && (
                    <span
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: "17px",
                        color: "#ffd44c",
                        fontWeight: 700,
                      }}
                    >
                      Total a Receber:{" "}
                      {formatMoney(
                        unpaidReadyOrDelivered.reduce(
                          (sum, o) => sum + Math.max(0, o.totalCents - (o.paidCents || 0)),
                          0
                        )
                      )}
                    </span>
                  )}
                </div>
              </div>

              {unpaidReadyOrDelivered.length === 0 ? (
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    border: "1px dashed rgba(34, 197, 94, 0.3)",
                    borderRadius: "12px",
                    padding: "24px",
                    textAlign: "center",
                    color: "#86efac",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckCircle2 size={28} style={{ color: "#22c55e" }} />
                  <strong style={{ fontSize: "14px" }}>Caixa 100% em dia!</strong>
                  <span style={{ fontSize: "12px", color: "#a8947f" }}>
                    Nenhum pedido pronto ou entregue pendente de pagamento no momento.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {unpaidReadyOrDelivered.map((order) => {
                    const items = (Array.isArray(order.items) ? order.items : []) as any[];
                    const balanceDue = Math.max(0, order.totalCents - (order.paidCents || 0));
                    return (
                      <div
                        key={order.code}
                        style={{
                          background: "rgba(20, 10, 6, 0.85)",
                          border: "1px solid rgba(245, 158, 11, 0.35)",
                          borderLeft: "4px solid #f59e0b",
                          borderRadius: "12px",
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "17px", color: "#fff" }}>
                                #{order.code}
                              </strong>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: order.status === "ready" ? "rgba(37, 99, 235, 0.2)" : "rgba(34, 197, 94, 0.2)",
                                  color: order.status === "ready" ? "#60a5fa" : "#86efac",
                                  border: `1px solid ${order.status === "ready" ? "rgba(37, 99, 235, 0.4)" : "rgba(34, 197, 94, 0.4)"}`,
                                }}
                              >
                                {order.status === "ready" ? "Pronto p/ Entrega" : "Entregue ao Cliente"}
                              </span>
                            </div>
                            <span style={{ display: "block", fontSize: "12px", color: "var(--cheddar)", marginTop: "2px" }}>
                              {order.tableName || order.origin} {order.customerName ? `• ${order.customerName}` : ""}
                            </span>
                          </div>
                          <span style={{ fontSize: "11px", color: "#a8947f" }}>
                            {formatTimeOnly(order.createdAt)}
                          </span>
                        </div>

                        {/* Items summary */}
                        <div style={{ fontSize: "11px", color: "#d6be9f", lineHeight: 1.4 }}>
                          {items.map((i, idx) => (
                            <span key={idx}>
                              {idx > 0 && " • "}
                              {i.quantity}x {i.name}
                            </span>
                          ))}
                        </div>

                        {/* Payment alert and action */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            paddingTop: "10px",
                            borderTop: "1px dashed rgba(255,255,255,0.08)",
                          }}
                        >
                          <div>
                            <span style={{ display: "block", fontSize: "10px", color: "#a8947f", textTransform: "uppercase" }}>
                              Saldo a Receber
                            </span>
                            <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "18px", color: "#f87171" }}>
                              {formatMoney(balanceDue)}
                            </strong>
                            {(order.paidCents || 0) > 0 && (
                              <span style={{ display: "block", fontSize: "10px", color: "#86efac" }}>
                                (Já pago: {formatMoney(order.paidCents || 0)})
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setReceivingOrder(order)}
                            style={{
                              background: "linear-gradient(135deg, #22c55e, #16a34a)",
                              color: "#fff",
                              border: 0,
                              borderRadius: "8px",
                              padding: "8px 14px",
                              fontSize: "11px",
                              fontWeight: 800,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              boxShadow: "0 2px 10px rgba(34, 197, 94, 0.4)",
                            }}
                          >
                            <CreditCard size={14} /> Receber / Dar Baixa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bloco 3: Histórico de Recebimentos & Formas de Pagamento Efetivadas */}
            <div
              style={{
                background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(20, 10, 6, 0.98))",
                border: "1px solid rgba(255, 196, 0, 0.22)",
                borderRadius: "16px",
                padding: "20px 24px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "16px",
                  paddingBottom: "14px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background: "rgba(34, 197, 94, 0.2)",
                      color: "#22c55e",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: "20px",
                        color: "#fff",
                        textTransform: "uppercase",
                        margin: 0,
                        letterSpacing: "0.5px",
                      }}
                    >
                      Recebimentos Efetivados & Formas de Pagamento
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a8947f" }}>
                      Discriminação das formas de pagamento efetivadas nos pedidos quitados.
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span
                    style={{
                      background: "rgba(255, 196, 0, 0.15)",
                      color: "#ffd44c",
                      border: "1px solid rgba(255, 196, 0, 0.3)",
                      borderRadius: "999px",
                      padding: "4px 12px",
                      fontSize: "12px",
                      fontWeight: 800,
                    }}
                  >
                    {paidOrders.length} pedido(s) quitado(s)
                  </span>
                  <span
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "18px",
                      color: "#86efac",
                      fontWeight: 700,
                    }}
                  >
                    Total Recebido:{" "}
                    {formatMoney(
                      paidOrders.reduce((sum, o) => sum + (o.paidCents || o.totalCents || 0), 0)
                    )}
                  </span>
                </div>
              </div>

              {paidOrders.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    textAlign: "center",
                    color: "#6e5a47",
                    fontSize: "12px",
                    border: "1px dashed rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                  }}
                >
                  Nenhum recebimento registrado até o momento.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#a8947f" }}>
                        <th style={{ padding: "10px 8px" }}>Pedido</th>
                        <th style={{ padding: "10px 8px" }}>Mesa / Cliente</th>
                        <th style={{ padding: "10px 8px" }}>Forma(s) Efetivada(s)</th>
                        <th style={{ padding: "10px 8px" }}>Operador</th>
                        <th style={{ padding: "10px 8px" }}>Horário</th>
                        <th style={{ padding: "10px 8px", textAlign: "right" }}>Valor Recebido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paidOrders.slice(0, 30).map((order) => {
                        const paymentsList = (order.payments || []) as PaymentItem[];
                        return (
                          <tr
                            key={order.code}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <td style={{ padding: "12px 8px" }}>
                              <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "14px", color: "#fff" }}>
                                #{order.code}
                              </strong>
                            </td>
                            <td style={{ padding: "12px 8px", color: "var(--cheddar)" }}>
                              {order.tableName || order.origin}
                              {order.customerName ? ` • ${order.customerName}` : ""}
                            </td>
                            <td style={{ padding: "12px 8px" }}>
                              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                                {paymentsList.length > 0 ? (
                                  paymentsList.map((p, idx) => {
                                    const cfg = getPaymentMethodDisplay(p.method, p.cardBrand);
                                    return (
                                      <span
                                        key={idx}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          background: cfg.bg,
                                          color: cfg.color,
                                          border: `1px solid ${cfg.border}`,
                                          borderRadius: "6px",
                                          padding: "3px 8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                        }}
                                      >
                                        <span>{cfg.icon}</span>
                                        <span>{cfg.label}: {formatMoney(p.amountCents)}</span>
                                        {p.changeCents ? (
                                          <small style={{ color: "#a8947f" }}>(troco {formatMoney(p.changeCents)})</small>
                                        ) : null}
                                      </span>
                                    );
                                  })
                                ) : (
                                  (() => {
                                    const cfg = getPaymentMethodDisplay(order.paymentMethod);
                                    return (
                                      <span
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "4px",
                                          background: cfg.bg,
                                          color: cfg.color,
                                          border: `1px solid ${cfg.border}`,
                                          borderRadius: "6px",
                                          padding: "3px 8px",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                        }}
                                      >
                                        <span>{cfg.icon}</span>
                                        <span>{cfg.label}: {formatMoney(order.paidCents || order.totalCents)}</span>
                                      </span>
                                    );
                                  })()
                                )}
                              </div>
                            </td>
                            <td style={{ padding: "12px 8px", color: "#a8947f" }}>
                              {order.operatorName || "Equipe"}
                            </td>
                            <td style={{ padding: "12px 8px", color: "#a8947f" }}>
                              {formatTimeOnly(order.createdAt)}
                            </td>
                            <td style={{ padding: "12px 8px", textAlign: "right" }}>
                              <strong style={{ color: "#86efac", fontSize: "14px" }}>
                                {formatMoney(order.paidCents || order.totalCents)}
                              </strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════
            TAB 3: RELATÓRIOS & DRE
           ═════════════════════════════════════════════════════════════════════ */}
        {tab === "reports" && statsQuery.data && (() => {
          const totalStatsRevenue = statsQuery.data.totals.revenue || 1;
          const rawByPayment = statsQuery.data.byPayment || [];

          const methodsCatalog = [
            { key: "pix", label: "Pix", icon: "💠", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.35)" },
            { key: "credito", label: "Cartão de Crédito", icon: "💳", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.35)" },
            { key: "debito", label: "Cartão de Débito", icon: "💳", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.35)" },
            { key: "dinheiro", label: "Dinheiro", icon: "💵", color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.35)" },
            { key: "vale_refeicao", label: "Vale Refeição", icon: "🎟️", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.15)", border: "rgba(139, 92, 246, 0.35)" },
          ];

          const reportPaymentMethods = methodsCatalog.map((cat) => {
            const found = rawByPayment.find((bp) => {
              const norm = (bp.paymentMethod || "").toLowerCase();
              if (cat.key === "pix") return norm.includes("pix");
              if (cat.key === "credito") return norm.includes("crédito") || norm.includes("credito");
              if (cat.key === "debito") return norm.includes("débito") || norm.includes("debito");
              if (cat.key === "dinheiro") return norm.includes("dinheiro");
              if (cat.key === "vale_refeicao") return norm.includes("vale") || norm.includes("refei") || norm.includes("vr");
              return false;
            });
            const revenue = found ? found.revenue : 0;
            const count = found ? found.count : 0;
            const avgTicket = count > 0 ? Math.round(revenue / count) : 0;
            const percent = totalStatsRevenue > 0 ? (revenue / totalStatsRevenue) * 100 : 0;
            return {
              ...cat,
              revenue,
              count,
              avgTicket,
              percent,
            };
          });

          const activePaymentMethods = reportPaymentMethods.filter((p) => p.revenue > 0 || p.count > 0);

          return (
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

              {/* Divisão por Formas de Pagamento (Gráfico de Rosca + Cards + Tabela Detalhada) */}
              <div
                style={{
                  background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(20, 10, 6, 0.98))",
                  border: "1px solid rgba(255, 196, 0, 0.22)",
                  borderRadius: "16px",
                  padding: "22px 24px",
                  boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                }}
              >
                <div style={{ marginBottom: "18px" }}>
                  <h3
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "20px",
                      color: "#fff",
                      textTransform: "uppercase",
                      margin: 0,
                      letterSpacing: "0.5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CircleDollarSign size={20} style={{ color: "var(--cheddar)" }} />
                    Divisão de Vendas por Forma de Pagamento
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#a8947f" }}>
                    Detalhamento de faturamento, volume e participação de cada modalidade efetivada.
                  </p>
                </div>

                {/* Cards rápidos por modalidade */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "12px",
                    marginBottom: "20px",
                  }}
                >
                  {reportPaymentMethods.map((pm) => (
                    <div
                      key={pm.key}
                      style={{
                        background: "rgba(20, 10, 6, 0.8)",
                        border: `1px solid ${pm.border}`,
                        borderRadius: "10px",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: pm.color, fontWeight: 800 }}>
                          {pm.icon} {pm.label}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            background: pm.bg,
                            color: pm.color,
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {pm.percent.toFixed(1)}%
                        </span>
                      </div>
                      <strong
                        style={{
                          display: "block",
                          fontFamily: "Oswald, sans-serif",
                          fontSize: "20px",
                          color: "#fff",
                          marginTop: "6px",
                        }}
                      >
                        {formatMoney(pm.revenue)}
                      </strong>
                      <span style={{ fontSize: "10px", color: "#a8947f" }}>
                        {pm.count} transação(ões) • Méd. {formatMoney(pm.avgTicket)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Grid 2 colunas: Gráfico Rosca + Tabela Comparativa */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "20px",
                    alignItems: "center",
                  }}
                >
                  {/* Gráfico Rosca */}
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "12px",
                      padding: "16px",
                      height: "280px",
                    }}
                  >
                    {activePaymentMethods.length === 0 ? (
                      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#6e5a47", fontSize: "12px" }}>
                        Sem pagamentos no período
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={activePaymentMethods.map((p) => ({
                              name: p.label,
                              value: p.revenue / 100,
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {activePaymentMethods.map((p, idx) => (
                              <Cell key={`cell-${idx}`} fill={p.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => [
                              (val).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
                              "Receita",
                            ]}
                            contentStyle={{
                              background: "#1f100a",
                              border: "1px solid rgba(255,196,0,0.3)",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#fff",
                            }}
                          />
                          <Legend
                            verticalAlign="bottom"
                            wrapperStyle={{ fontSize: "11px", paddingTop: "10px", color: "#d6be9f" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Tabela Discriminada */}
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                      borderRadius: "12px",
                      padding: "16px",
                      overflowX: "auto",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#a8947f" }}>
                          <th style={{ padding: "8px 6px" }}>Forma</th>
                          <th style={{ padding: "8px 6px", textAlign: "center" }}>Vendas</th>
                          <th style={{ padding: "8px 6px", textAlign: "right" }}>Total (R$)</th>
                          <th style={{ padding: "8px 6px", textAlign: "right" }}>Ticket Médio</th>
                          <th style={{ padding: "8px 6px", textAlign: "right" }}>Part.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportPaymentMethods.map((pm) => (
                          <tr key={pm.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                            <td style={{ padding: "10px 6px", fontWeight: 700, color: pm.color }}>
                              {pm.icon} {pm.label}
                            </td>
                            <td style={{ padding: "10px 6px", textAlign: "center", color: "#d6be9f" }}>
                              {pm.count}
                            </td>
                            <td style={{ padding: "10px 6px", textAlign: "right", color: "#fff", fontWeight: 700 }}>
                              {formatMoney(pm.revenue)}
                            </td>
                            <td style={{ padding: "10px 6px", textAlign: "right", color: "#a8947f" }}>
                              {formatMoney(pm.avgTicket)}
                            </td>
                            <td style={{ padding: "10px 6px", textAlign: "right" }}>
                              <span
                                style={{
                                  background: pm.bg,
                                  color: pm.color,
                                  border: `1px solid ${pm.border}`,
                                  borderRadius: "4px",
                                  padding: "2px 6px",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                }}
                              >
                                {pm.percent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
          );
        })()}

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

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            ordersQuery.refetch();
          }}
        />
      )}

      {isAuditModalOpen && <AuditLogModal onClose={() => setIsAuditModalOpen(false)} />}

      <BrandFooter />
    </div>
  );
}

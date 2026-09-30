import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  LockKeyhole,
  Minus,
  MonitorSmartphone,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  ShieldAlert,
  FileSpreadsheet,
  AlertCircle,
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
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { MENU_CATEGORIES, type MenuCategory, type MenuItem } from "../../../shared/menu";
import { trpc } from "@/lib/trpc";
import { ReceivePaymentModal } from "@/components/financial/ReceivePaymentModal";
import { CashRegisterControl } from "@/components/financial/CashRegisterControl";
import { CancelRefundModal } from "@/components/financial/CancelRefundModal";
import { AuditLogModal } from "@/components/financial/AuditLogModal";

// ─── Helpers ────────────────────────────────────────────────────────────────
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categoryEmoji: Record<MenuCategory, string> = {
  Combos: "🍔",
  Hambúrgueres: "🥩",
  Baguetes: "🥖",
  Tradicionais: "🧀",
  Fritas: "🍟",
  "Milk-shakes": "🥤",
  Bebidas: "🧃",
  Adicionais: "✨",
};
const categoryClass: Record<MenuCategory, string> = {
  Combos: "combo",
  Hambúrgueres: "burger",
  Baguetes: "baguette",
  Tradicionais: "traditional",
  Fritas: "fries",
  "Milk-shakes": "shake",
  Bebidas: "drink",
  Adicionais: "extra",
};

type CartLine = MenuItem & { quantity: number; observation: string };
type ServiceMode = "customer" | "waiter" | "counter";
type OrderStatus = "received" | "preparing" | "ready" | "completed" | "cancelled";
type FinancialStatus = "pending" | "partial" | "paid" | "refunded" | "cancelled";
type OpsTab = "orders" | "financial" | "reports";
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
  status: OrderStatus;
  financialStatus?: FinancialStatus;
  operatorName?: string | null;
  createdAt: string | Date;
  payments?: PaymentItem[];
}

const MODE_CONFIG = {
  customer: {
    icon: <QrCode size={28} />,
    label: "Cliente",
    desc: "Pedido via QR Code",
    accent: "#16a34a",
    bg: "#f0fdf4",
    border: "#86efac",
  },
  waiter: {
    icon: <Users size={28} />,
    label: "Garçom",
    desc: "Pedido por mesa",
    accent: "#d97706",
    bg: "#fffbeb",
    border: "#fcd34d",
  },
  counter: {
    icon: <MonitorSmartphone size={28} />,
    label: "Balcão",
    desc: "Atendimento rápido",
    accent: "#2563eb",
    bg: "#eff6ff",
    border: "#93c5fd",
  },
} as const;

const PIE_COLORS = [
  "#f07b17",
  "#ffc400",
  "#5c823b",
  "#2563eb",
  "#d97706",
  "#16a34a",
  "#9333ea",
  "#e11d48",
];

// ─── Sub-components ──────────────────────────────────────────────────────────
function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""}`}>
      <div className="brand-mark">🍔</div>
      <div>
        <strong>MEU CHAPA</strong>
        <em>Burger</em>
      </div>
    </div>
  );
}

function FoodArt({ item, large = false }: { item: MenuItem; large?: boolean }) {
  return (
    <div className={`food-art ${categoryClass[item.category]} ${large ? "large" : ""}`}>
      <span>{categoryEmoji[item.category]}</span>
      <small>{item.tags?.[0] ?? "feito na chapa"}</small>
    </div>
  );
}

function ProductCard({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) {
  return (
    <article className="product-card">
      <FoodArt item={item} />
      <div className="product-card-body">
        <div className="eyebrow-row">
          <span>{item.category}</span>
          {item.tags?.[0] && <b>{item.tags[0]}</b>}
        </div>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="product-card-footer">
          <strong>{money(item.priceCents)}</strong>
          <button className="add-button" onClick={() => onAdd(item)}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductDialog({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number, observation: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  if (!item) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">personalize sua mordida</span>
            <h2>{item.name}</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <FoodArt item={item} large />
        <p className="modal-description">{item.description}</p>
        <label className="field-label">
          Quantidade
          <div className="quantity-control">
            <button onClick={() => setQuantity((v) => Math.max(1, v - 1))}>
              <Minus size={16} />
            </button>
            <strong>{quantity}</strong>
            <button onClick={() => setQuantity((v) => v + 1)}>
              <Plus size={16} />
            </button>
          </div>
        </label>
        <label className="field-label">
          Observação para a chapa
          <textarea
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex.: sem cebola, molho separado, bem passado..."
            rows={3}
          />
        </label>
        <Button
          className="primary-button full"
          onClick={() => {
            onAdd(item, quantity, observation);
            onClose();
          }}
        >
          Adicionar à comanda <ArrowRight size={17} />
        </Button>
      </div>
    </div>
  );
}

function Cart({
  cart,
  onChange,
  onCheckout,
}: {
  cart: CartLine[];
  onChange: (line: CartLine, qty: number) => void;
  onCheckout: () => void;
}) {
  const total = cart.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  return (
    <aside className="cart-panel">
      <div className="cart-panel-head">
        <div>
          <span className="eyebrow">sua comanda</span>
          <h2>Na chapa</h2>
        </div>
        <span className="cart-count">
          {cart.reduce((s, i) => s + i.quantity, 0)} itens
        </span>
      </div>
      {cart.length === 0 ? (
        <div className="cart-empty">
          <ReceiptText size={30} />
          <strong>Sua chapa está esperando um pedido.</strong>
          <span>Escolha um item do cardápio para começar.</span>
        </div>
      ) : (
        <div className="cart-lines">
          {cart.map((line) => (
            <div className="cart-line" key={`${line.id}-${line.observation}`}>
              <div className="cart-line-info">
                <strong>
                  {line.quantity}× {line.name}
                </strong>
                {line.observation && <span>↳ {line.observation}</span>}
                <small>{money(line.priceCents)} cada</small>
              </div>
              <div className="cart-line-actions">
                <strong>{money(line.priceCents * line.quantity)}</strong>
                <div className="quantity-control mini">
                  <button onClick={() => onChange(line, line.quantity - 1)}>
                    <Minus size={13} />
                  </button>
                  <span>{line.quantity}</span>
                  <button onClick={() => onChange(line, line.quantity + 1)}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="cart-total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
      <Button className="primary-button full" disabled={!cart.length} onClick={onCheckout}>
        Revisar pedido <ArrowRight size={17} />
      </Button>
    </aside>
  );
}

function Confirmation({ code, onNewOrder }: { code: string; onNewOrder: () => void }) {
  const query = trpc.orders.get.useQuery({ code }, { refetchInterval: 10000 });
  const order = query.data;
  const labels: Record<OrderStatus, string> = {
    received: "Pedido recebido",
    preparing: "Na chapa",
    ready: "Pronto para sair",
    completed: "Entregue",
    cancelled: "Cancelado",
  };
  return (
    <section className="confirmation-card">
      <div className="confirmation-icon">
        <Check size={30} />
      </div>
      <span className="eyebrow">pedido enviado</span>
      <h1>Deixa com a chapa.</h1>
      <p>
        Seu pedido <strong>#{code}</strong> foi registrado. A cozinha já recebeu os detalhes.
      </p>
      <div className="order-status">
        <span className="status-dot" />
        {order ? labels[order.status] : "Confirmando na cozinha"}
      </div>
      <div className="status-steps">
        <span className={order?.status !== "cancelled" ? "active" : ""}>
          <ReceiptText size={16} /> Recebido
        </span>
        <span className={["preparing", "ready", "completed"].includes(order?.status ?? "") ? "active" : ""}>
          <Flame size={16} /> Na chapa
        </span>
        <span className={["ready", "completed"].includes(order?.status ?? "") ? "active" : ""}>
          <Check size={16} /> Pronto
        </span>
      </div>
      <Button className="secondary-button" onClick={onNewOrder}>
        Fazer outro pedido
      </Button>
    </section>
  );
}

// ─── Mode Selector ───────────────────────────────────────────────────────────
function ServiceModePicker({
  onSelect,
  onOps,
}: {
  onSelect: (m: ServiceMode) => void;
  onOps: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"all" | "customer" | "team">("all");

  return (
    <div className="service-picker-wrapper">
      {/* Background Atmosphere Glows */}
      <div className="service-picker-glow glow-top" />
      <div className="service-picker-glow glow-bottom" />

      <div className="service-picker-container">
        {/* Brand Header */}
        <header className="service-picker-header">
          <div className="service-picker-logo-box">
            <img
              src="/meu-chapa-logo.jpg"
              alt="Meu Chapa Burger - Est. 2023 - Quality Guaranteed"
              className="service-picker-logo-img"
            />
          </div>

          <div className="service-picker-badges">
            <span className="gold-pill">
              <Sparkles size={13} /> Tradição na Brasa
            </span>
            <span className="gold-pill">
              <Flame size={13} /> Sabor Artesanal
            </span>
            <span className="gold-pill">★ Est. 2023 • Quality Guaranteed</span>
          </div>

          <h1 className="service-picker-title">
            Bem-vindo ao <span>Meu Chapa</span>
          </h1>
          <p className="service-picker-subtitle">
            Selecione o ambiente desejado para uma experiência rápida, prática e intuitiva.
          </p>

          {/* Quick Environment Filter Tabs */}
          <div className="service-picker-tabs">
            <button
              type="button"
              className={`picker-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              <Sparkles size={14} /> Todos os Ambientes
            </button>
            <button
              type="button"
              className={`picker-tab ${activeTab === "customer" ? "active" : ""}`}
              onClick={() => setActiveTab("customer")}
            >
              <QrCode size={14} /> Espaço do Cliente
            </button>
            <button
              type="button"
              className={`picker-tab ${activeTab === "team" ? "active" : ""}`}
              onClick={() => setActiveTab("team")}
            >
              <ChefHat size={14} /> Central da Equipe
            </button>
          </div>
        </header>

        {/* Environments Grid */}
        <div className={`service-environments-grid ${activeTab !== "all" ? "single-focus" : ""}`}>
          {/* ══════════════════════════════════════════
              AMBIENTE DO CLIENTE (Autoatendimento & Cardápio)
             ══════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "customer") && (
            <section className="environment-card customer-portal">
              <div className="card-top-tag">
                <span className="tag-badge customer">
                  <QrCode size={13} /> Espaço do Cliente
                </span>
                <span className="tag-status">Autoatendimento • QR Code</span>
              </div>

              <div className="customer-portal-body">
                <div className="portal-icon-wrapper">
                  <div className="portal-icon-inner customer-glow">
                    <QrCode size={36} />
                  </div>
                </div>

                <div className="portal-info">
                  <h2>Cardápio Digital & Pedidos</h2>
                  <p>
                    Faça seu pedido diretamente pelo celular via QR Code da mesa ou explore nossos burgers artesanais, porções crocantes e bebidas geladas.
                  </p>
                </div>

                {/* Highlights */}
                <div className="customer-perks">
                  <div className="perk-item">
                    <Flame size={16} className="perk-icon" />
                    <div>
                      <strong>Burgers Feitos na Chapa</strong>
                      <span>Blend especial moído fresco e grelhado no ponto</span>
                    </div>
                  </div>
                  <div className="perk-item">
                    <Clock3 size={16} className="perk-icon" />
                    <div>
                      <strong>Sem Filas nem Espera</strong>
                      <span>Seu pedido vai direto para a chapa da cozinha</span>
                    </div>
                  </div>
                  <div className="perk-item">
                    <ReceiptText size={16} className="perk-icon" />
                    <div>
                      <strong>Acompanhamento em Tempo Real</strong>
                      <span>Notificações claras: Recebido, Na Chapa e Pronto</span>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  className="portal-primary-btn"
                  onClick={() => onSelect("customer")}
                >
                  <span>Acessar Cardápio & Fazer Pedido</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </section>
          )}

          {/* ══════════════════════════════════════════
              AMBIENTE DA EQUIPE (Salão, Balcão e Cozinha)
             ══════════════════════════════════════════ */}
          {(activeTab === "all" || activeTab === "team") && (
            <section className="environment-card team-portal">
              <div className="card-top-tag">
                <span className="tag-badge team">
                  <ChefHat size={13} /> Central da Equipe
                </span>
                <span className="tag-status">Operação & Atendimento</span>
              </div>

              <div className="team-portal-body">
                <div className="team-portal-head">
                  <h2>Acesso Operacional</h2>
                  <p>
                    Ferramentas práticas e intuitivas para o time Meu Chapa agilizar o salão, balcão e produção.
                  </p>
                </div>

                {/* Team Options */}
                <div className="team-options-list">
                  {/* Option 1: Waiter */}
                  <div
                    className="team-option-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect("waiter")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelect("waiter");
                    }}
                  >
                    <div className="option-icon waiter-bg">
                      <Users size={22} />
                    </div>
                    <div className="option-content">
                      <div className="option-title-row">
                        <strong>Modo Garçom</strong>
                        <span className="option-pill">Mesas</span>
                      </div>
                      <p>Lançamento ágil de pedidos por mesa, comanda e clientes no salão.</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </div>

                  {/* Option 2: Counter */}
                  <div
                    className="team-option-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect("counter")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelect("counter");
                    }}
                  >
                    <div className="option-icon counter-bg">
                      <MonitorSmartphone size={22} />
                    </div>
                    <div className="option-content">
                      <div className="option-title-row">
                        <strong>Modo Balcão</strong>
                        <span className="option-pill">PDV Rápido</span>
                      </div>
                      <p>Atendimento presencial de balcão, pedidos para viagem e caixa.</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </div>

                  {/* Option 3: Kitchen & Management */}
                  <div
                    className="team-option-card ops-card"
                    role="button"
                    tabIndex={0}
                    onClick={onOps}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onOps();
                    }}
                  >
                    <div className="option-icon ops-bg">
                      <Flame size={22} />
                    </div>
                    <div className="option-content">
                      <div className="option-title-row">
                        <strong>Cozinha & Gestão (KDS)</strong>
                        <span className="option-pill ops-pill">
                          <LockKeyhole size={11} /> Painel Geral
                        </span>
                      </div>
                      <p>Controle de pedidos na chapa, financeiro, fechamento de caixa e relatórios.</p>
                    </div>
                    <ChevronRight size={18} className="option-arrow" />
                  </div>
                </div>

                <div className="team-quick-footer">
                  <span>🔒 Acesso seguro para colaboradores e gerência Meu Chapa</span>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer info */}
        <footer className="service-picker-footer">
          <p>
            © {new Date().getFullYear()} Meu Chapa Burger • Qualidade Garantida desde 2023 • Feito com paixão na chapa
          </p>
        </footer>
      </div>
    </div>
  );
}

function ModeBadge({ mode, onSwitch }: { mode: ServiceMode; onSwitch: () => void }) {
  const cfg = MODE_CONFIG[mode];
  return (
    <button
      onClick={onSwitch}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ".4rem",
        padding: ".35rem .75rem",
        borderRadius: "999px",
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.accent,
        fontSize: "11px",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {cfg.icon} {cfg.label} <ChevronRight size={13} />
    </button>
  );
}

function WaiterBar({
  tableName,
  customerName,
  onChange,
}: {
  tableName: string;
  customerName: string;
  onChange: (t: string, c: string) => void;
}) {
  return (
    <div
      style={{
        background: "#fffbeb",
        borderBottom: "2px solid #fcd34d",
        padding: ".625rem clamp(20px,8vw,140px)",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 800,
          color: "#d97706",
          textTransform: "uppercase",
          letterSpacing: ".8px",
          whiteSpace: "nowrap",
        }}
      >
        🧑‍🍳 Pedido Garçom
      </span>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".4rem",
          fontSize: "12px",
          color: "#92400e",
        }}
      >
        Mesa:
        <input
          value={tableName}
          onChange={(e) => onChange(e.target.value, customerName)}
          placeholder="Nº da mesa"
          style={{
            border: "1px solid #fcd34d",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "12px",
            width: "110px",
            background: "white",
          }}
        />
      </label>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: ".4rem",
          fontSize: "12px",
          color: "#92400e",
        }}
      >
        Cliente:
        <input
          value={customerName}
          onChange={(e) => onChange(tableName, e.target.value)}
          placeholder="Nome (opcional)"
          style={{
            border: "1px solid #fcd34d",
            borderRadius: "6px",
            padding: "4px 8px",
            fontSize: "12px",
            width: "140px",
            background: "white",
          }}
        />
      </label>
    </div>
  );
}

function printOrder(order: StoredOrder) {
  const items = Array.isArray(order.items)
    ? (order.items as Array<{
        name: string;
        quantity: number;
        unitPriceCents: number;
        observation?: string;
      }>)
    : [];
  const itemHtml = items
    .map(
      (i) =>
        `<div class="r-item"><span><b>${i.quantity}×</b> ${i.name}${
          i.observation ? `<small>↳ ${i.observation}</small>` : ""
        }</span><strong>${money(i.unitPriceCents * i.quantity)}</strong></div>`
    )
    .join("");
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;
  popup.document.write(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ${
      order.code
    }</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;width:72mm;margin:0;color:#111;font-size:12px}.head{text-align:center;border-bottom:2px dashed #111;padding-bottom:8px;margin-bottom:8px}.brand{font-size:20px;font-weight:900;letter-spacing:1px}.meta{line-height:1.5;border-bottom:1px dashed #111;padding-bottom:8px}.r-item{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #999;padding:7px 0}.r-item span{max-width:52mm}.r-item small{display:block;font-size:10px;margin-top:3px}.total{display:flex;justify-content:space-between;font-size:17px;font-weight:900;border-top:2px solid #111;margin-top:8px;padding-top:8px}.note{border:1px solid #111;padding:6px;margin-top:8px;font-size:11px}.foot{text-align:center;border-top:2px dashed #111;margin-top:12px;padding-top:8px;font-size:10px}</style></head><body><div class="head"><div class="brand">MEU CHAPA</div><div>COMANDA DE PEDIDO</div><div>Pedido #${
      order.code
    }</div></div><div class="meta"><b>Origem:</b> ${order.origin}<br><b>Mesa:</b> ${
      order.tableName || "—"
    }${order.customerName ? `<br><b>Cliente:</b> ${order.customerName}` : ""}<br><b>Pagamento:</b> ${
      order.paymentMethod
    }</div>${itemHtml}<div class="total"><span>TOTAL</span><span>${money(
      order.totalCents
    )}</span></div>${
      order.notes ? `<div class="note"><b>OBSERVAÇÃO</b><br>${order.notes}</div>` : ""
    }<div class="foot">Feito na chapa. Montado do seu jeito.</div></body></html>`
  );
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 240);
}

// ─── Financial Status & Labels ──────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  preparing: "Na chapa",
  ready: "Pronto",
  completed: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  received: "#d97706",
  preparing: "#f07b17",
  ready: "#2563eb",
  completed: "#16a34a",
  cancelled: "#6b7280",
};

const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
  refunded: "Estornado",
  cancelled: "Cancelado",
};

const FINANCIAL_STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  pending: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  partial: { bg: "#ffedd5", color: "#c2410c", border: "#fdba74" },
  paid: { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  refunded: { bg: "#f3e8ff", color: "#6b21a8", border: "#d8b4fe" },
  cancelled: { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" },
};

const MODE_ICON: Record<string, string> = {
  customer: "📱",
  waiter: "🧑‍🍳",
  counter: "🧾",
};

type FinancialPeriod = "today" | "yesterday" | "week" | "month";

function getPeriodRange(period: FinancialPeriod): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
} {
  const now = new Date();
  const startOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const endOf = (d: Date) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  if (period === "today") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return {
      start: startOf(now),
      end: endOf(now),
      prevStart: startOf(y),
      prevEnd: endOf(y),
      label: "Hoje",
    };
  }
  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const beforeY = new Date(now);
    beforeY.setDate(beforeY.getDate() - 2);
    return {
      start: startOf(y),
      end: endOf(y),
      prevStart: startOf(beforeY),
      prevEnd: endOf(beforeY),
      label: "Ontem",
    };
  }
  if (period === "week") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    const ps = new Date(s);
    ps.setDate(ps.getDate() - 7);
    const pe = new Date(s);
    pe.setDate(pe.getDate() - 1);
    return {
      start: startOf(s),
      end: endOf(now),
      prevStart: startOf(ps),
      prevEnd: endOf(pe),
      label: "Últimos 7 dias",
    };
  }
  // month
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pe = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    start: startOf(s),
    end: endOf(now),
    prevStart: startOf(ps),
    prevEnd: endOf(pe),
    label: "Este mês",
  };
}

// ─── Financial Tab Component ────────────────────────────────────────────────
function FinancialTab() {
  const [period, setPeriod] = useState<FinancialPeriod>("today");
  const [configOpen, setConfigOpen] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Modais de ação
  const [receivingOrder, setReceivingOrder] = useState<StoredOrder | null>(null);
  const [cancelRefundModal, setCancelRefundModal] = useState<{
    type: "cancel_order" | "refund_payment";
    idOrCode: string | number;
    title: string;
  } | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);

  const range = getPeriodRange(period);

  // Queries
  const ordersQuery = trpc.orders.listByPeriod.useQuery(
    { start: range.start.toISOString(), end: range.end.toISOString() },
    { refetchInterval: 15000 }
  );

  const prevOrdersQuery = trpc.orders.listByPeriod.useQuery(
    { start: range.prevStart.toISOString(), end: range.prevEnd.toISOString() }
  );

  const activeCashQuery = trpc.cash.getActive.useQuery();
  const settingsQuery = trpc.settings.getPaymentMethods.useQuery();
  const setMethodsMutation = trpc.settings.setPaymentMethods.useMutation({
    onSuccess: () => settingsQuery.refetch(),
  });

  const periodOrders = (ordersQuery.data ?? []) as unknown as StoredOrder[];
  const prevPeriodOrders = (prevOrdersQuery.data ?? []) as unknown as StoredOrder[];

  // Formas de pagamento aceitas configuráveis
  const activeMethods = settingsQuery.data || [
    "Pix",
    "Cartão Crédito",
    "Cartão Débito",
    "Dinheiro",
    "Vale Refeição",
  ];
  const allAvailableMethods = [
    "Pix",
    "Cartão Crédito",
    "Cartão Débito",
    "Dinheiro",
    "Vale Refeição",
  ];

  const toggleMethod = (m: string) => {
    const next = activeMethods.includes(m)
      ? activeMethods.filter((x) => x !== m)
      : [...activeMethods, m];
    if (next.length > 0) {
      setMethodsMutation.mutate({ methods: next });
    }
  };

  // Cálculo de receita real exclusivamente por pagamentos confirmados
  const confirmedPayments: PaymentItem[] = [];
  let refundedCentsTotal = 0;
  for (const o of periodOrders) {
    if (o.payments && Array.isArray(o.payments)) {
      for (const p of o.payments) {
        if (p.status === "confirmed") {
          confirmedPayments.push(p);
        } else if (p.status === "refunded") {
          refundedCentsTotal += p.amountCents;
        }
      }
    }
  }

  const totalConfirmedRevenue = confirmedPayments.reduce(
    (sum, p) => sum + p.amountCents,
    0
  );

  const pendingOrders = periodOrders.filter(
    (o) => o.status !== "cancelled" && o.financialStatus !== "paid"
  );
  const pendingCentsTotal = pendingOrders.reduce(
    (sum, o) => sum + Math.max(0, o.totalCents - (o.paidCents || 0)),
    0
  );

  const activeOrders = periodOrders.filter((o) => o.status !== "cancelled");
  const avgTicket = activeOrders.length
    ? Math.round(totalConfirmedRevenue / activeOrders.length)
    : 0;

  // Comparação com período anterior
  let prevConfirmedRevenue = 0;
  for (const o of prevPeriodOrders) {
    if (o.payments && Array.isArray(o.payments)) {
      for (const p of o.payments) {
        if (p.status === "confirmed") prevConfirmedRevenue += p.amountCents;
      }
    }
  }

  const calcDiffPct = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const pct = Math.round(((current - previous) / previous) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  const revenueVariation = calcDiffPct(totalConfirmedRevenue, prevConfirmedRevenue);
  const ordersVariation = calcDiffPct(activeOrders.length, prevPeriodOrders.length);

  // Rateio por forma de pagamento (real por item de pagamento)
  const byPaymentMap: Record<string, { count: number; revenue: number }> = {};
  const methodLabelMap: Record<string, string> = {
    pix: "Pix",
    credito: "Cartão Crédito",
    debito: "Cartão Débito",
    dinheiro: "Dinheiro",
    vale_refeicao: "Vale Refeição",
  };

  for (const p of confirmedPayments) {
    const label = methodLabelMap[p.method] || p.method;
    if (!byPaymentMap[label]) byPaymentMap[label] = { count: 0, revenue: 0 };
    byPaymentMap[label].count++;
    byPaymentMap[label].revenue += p.amountCents;
  }

  const byPaymentList = Object.entries(byPaymentMap).map(([name, data]) => ({
    name,
    count: data.count,
    revenue: data.revenue,
    value: data.revenue,
    pct:
      totalConfirmedRevenue > 0
        ? Math.round((data.revenue / totalConfirmedRevenue) * 100)
        : 0,
    avgTicket: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
  }));
  byPaymentList.sort((a, b) => b.revenue - a.revenue);

  // Exportação CSV
  const exportCsv = () => {
    const headers = [
      "Código",
      "Data e Hora",
      "Origem",
      "Mesa/Cliente",
      "Operador",
      "Forma de Pagamento",
      "Status Operacional",
      "Status Financeiro",
      "Total (R$)",
      "Pago (R$)",
    ];
    const rows = periodOrders.map((o) => [
      o.code,
      new Date(o.createdAt).toLocaleString("pt-BR"),
      o.origin,
      `"${(o.tableName || "") + " " + (o.customerName || "")}"`,
      o.operatorName || "—",
      `"${o.paymentMethod}"`,
      STATUS_LABELS[o.status] || o.status,
      FINANCIAL_STATUS_LABELS[o.financialStatus || "pending"] || o.financialStatus,
      (o.totalCents / 100).toFixed(2),
      ((o.paidCents || 0) / 100).toFixed(2),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pedidos_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const card = (
    title: string,
    value: string,
    sub?: string,
    badgeText?: string,
    badgeColor?: string
  ) => (
    <div
      style={{
        background: "var(--chapa-900)",
        color: "#fff3df",
        borderRadius: 11,
        padding: "16px 18px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            display: "block",
            color: "#c9b18e",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".7px",
          }}
        >
          {title}
        </span>
        {badgeText && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: 4,
              background: badgeColor || "#16a34a",
              color: "white",
            }}
          >
            {badgeText}
          </span>
        )}
      </div>
      <strong
        style={{
          display: "block",
          color: "var(--cheddar)",
          fontFamily: "Oswald,sans-serif",
          fontSize: 26,
          marginTop: 6,
        }}
      >
        {value}
      </strong>
      {sub && <span style={{ fontSize: 10, color: "#a88e6a", marginTop: 4, display: "block" }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* ── Submódulo de Caixa / Turno ── */}
      <CashRegisterControl onRefreshNeeded={() => ordersQuery.refetch()} />

      {/* ── Formas de Pagamento Aceitas (Salvas no Servidor) ── */}
      <div
        style={{
          background: "#fffdf9",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setConfigOpen((o) => !o)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 13,
            color: "var(--chapa-900)",
          }}
        >
          <span>⚙️ Formas de pagamento aceitas na loja</span>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
            {activeMethods.length} ativas (sincronizadas no servidor) — clique para{" "}
            {configOpen ? "fechar" : "configurar"}
          </span>
        </button>
        {configOpen && (
          <div
            style={{
              borderTop: "1px solid var(--line)",
              padding: "16px 18px",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {allAvailableMethods.map((m) => {
              const active = activeMethods.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMethod(m)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1.5px solid ${active ? "var(--brasa)" : "var(--line)"}`,
                    background: active ? "var(--chapa-900)" : "#fffaf0",
                    color: active ? "var(--cheddar)" : "var(--muted)",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all .18s",
                  }}
                >
                  {active ? "✓" : "○"} {m}
                </button>
              );
            })}
            <p style={{ width: "100%", margin: "8px 0 0", fontSize: 10, color: "var(--muted)" }}>
              As formas ativas são sincronizadas automaticamente em todos os tablets, celulares e
              PDVs do restaurante.
            </p>
          </div>
        )}
      </div>

      {/* ── Barra de Filtro de Período e Auditoria ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginRight: 4 }}>
            Período:
          </span>
          {(["today", "yesterday", "week", "month"] as FinancialPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "7px 16px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                background: period === p ? "var(--chapa-900)" : "#fffaf0",
                color: period === p ? "var(--cheddar)" : "var(--muted)",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {getPeriodRange(p).label}
            </button>
          ))}
          {ordersQuery.isFetching && (
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Atualizando…</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={exportCsv}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "#ffffff",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--chapa-900)",
              cursor: "pointer",
            }}
          >
            <FileSpreadsheet size={14} /> Exportar CSV
          </button>
          <button
            onClick={() => setAuditOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #fed7aa",
              background: "#fff7ed",
              fontSize: 11,
              fontWeight: 700,
              color: "#c2410c",
              cursor: "pointer",
            }}
          >
            <ShieldAlert size={14} /> Trilha de Auditoria
          </button>
        </div>
      </div>

      {/* ── KPIs do Período com Comparativo ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {card(
          "Receita Confirmada (" + range.label + ")",
          money(totalConfirmedRevenue),
          `Vs período anterior: ${revenueVariation}`,
          revenueVariation.startsWith("+") ? revenueVariation : undefined,
          revenueVariation.startsWith("+") ? "#16a34a" : "#dc2626"
        )}
        {card(
          "A Receber (Pendente)",
          money(pendingCentsTotal),
          `${pendingOrders.length} pedido(s) não quitado(s)`,
          pendingCentsTotal > 0 ? "ATENÇÃO" : "ZERADO",
          pendingCentsTotal > 0 ? "#d97706" : "#16a34a"
        )}
        {card(
          "Pedidos Realizados",
          String(activeOrders.length),
          `Vs período anterior: ${ordersVariation}`
        )}
        {card("Ticket Médio Real", money(avgTicket), "Por venda liquidada")}
        {card("Estornos / Cancelados", money(refundedCentsTotal), "Estornos no período")}
      </div>

      {/* ── Rateio Real por Forma de Pagamento ── */}
      {byPaymentList.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {/* Gráfico Pizza */}
          <div
            style={{
              background: "#fffdf9",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "1.25rem",
            }}
          >
            <h3
              style={{
                fontFamily: "Oswald,sans-serif",
                textTransform: "uppercase",
                fontSize: 17,
                margin: "0 0 1rem",
                color: "var(--chapa-900)",
              }}
            >
              Distribuição da Receita Real
            </h3>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={byPaymentList}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  label={({ name, percent }) =>
                    `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {byPaymentList.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela de Detalhamento por Forma */}
          <div
            style={{
              background: "#fffdf9",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "1.25rem",
            }}
          >
            <h3
              style={{
                fontFamily: "Oswald,sans-serif",
                textTransform: "uppercase",
                fontSize: 17,
                margin: "0 0 1rem",
                color: "var(--chapa-900)",
              }}
            >
              Detalhamento de Pagamentos
            </h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr
                  style={{
                    color: "var(--muted)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".6px",
                  }}
                >
                  <th style={{ textAlign: "left", padding: "5px 0" }}>Forma</th>
                  <th style={{ textAlign: "center", padding: "5px 0" }}>Qtd</th>
                  <th style={{ textAlign: "right", padding: "5px 0" }}>Ticket</th>
                  <th style={{ textAlign: "right", padding: "5px 0" }}>Total (% Líq)</th>
                </tr>
              </thead>
              <tbody>
                {byPaymentList.map((p, i) => (
                  <tr key={i} style={{ borderTop: "1px dashed var(--line)" }}>
                    <td style={{ padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: PIE_COLORS[i % PIE_COLORS.length],
                          display: "inline-block",
                        }}
                      />
                      <b>{p.name}</b>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{p.count}x</td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>
                      {money(p.avgTicket)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "var(--brasa)" }}>
                      {money(p.revenue)} <small style={{ color: "var(--muted)" }}>({p.pct}%)</small>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--line)" }}>
                  <td style={{ padding: "8px 0", fontWeight: 800 }}>Total Confirmado</td>
                  <td style={{ textAlign: "center", fontWeight: 800 }}>
                    {confirmedPayments.length}x
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{money(avgTicket)}</td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "var(--brasa)", fontSize: 14 }}>
                    {money(totalConfirmedRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Todos os Pedidos do Período com Baixa e Estorno ── */}
      <div
        style={{
          background: "#fffdf9",
          border: "1px solid var(--line)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3
            style={{
              fontFamily: "Oswald,sans-serif",
              textTransform: "uppercase",
              fontSize: 17,
              margin: 0,
              color: "var(--chapa-900)",
            }}
          >
            📋 Todos os pedidos — {range.label}
          </h3>
          <span
            style={{
              background: "var(--creme)",
              color: "var(--muted)",
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 800,
            }}
          >
            {periodOrders.length} pedidos
          </span>
        </div>

        {ordersQuery.isLoading ? (
          <div className="loading-state">Carregando pedidos…</div>
        ) : periodOrders.length === 0 ? (
          <p
            style={{
              color: "var(--muted)",
              fontSize: 12,
              textAlign: "center",
              padding: "2.5rem",
            }}
          >
            Nenhum pedido neste período.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0, background: "#f7f0e6" }}>
                <tr
                  style={{
                    color: "var(--muted)",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".6px",
                  }}
                >
                  <th style={{ textAlign: "left", padding: "8px 14px" }}>Código</th>
                  <th style={{ textAlign: "left", padding: "8px 8px" }}>Hora</th>
                  <th style={{ textAlign: "left", padding: "8px 8px" }}>Origem / Atendente</th>
                  <th style={{ textAlign: "left", padding: "8px 8px" }}>Mesa / Cliente</th>
                  <th style={{ textAlign: "left", padding: "8px 8px" }}>Pagamento Real</th>
                  <th style={{ textAlign: "center", padding: "8px 8px" }}>Status Oper.</th>
                  <th style={{ textAlign: "center", padding: "8px 8px" }}>Status Financ.</th>
                  <th style={{ textAlign: "right", padding: "8px 8px" }}>Total</th>
                  <th style={{ textAlign: "center", padding: "8px 14px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {periodOrders.map((order) => {
                  const items = Array.isArray(order.items)
                    ? (order.items as Array<{
                        name: string;
                        quantity: number;
                        unitPriceCents: number;
                        observation?: string;
                      }>)
                    : [];
                  const isExpanded = expandedOrder === order.code;
                  const finStatus = order.financialStatus || "pending";
                  const fcfg =
                    FINANCIAL_STATUS_COLORS[finStatus] || FINANCIAL_STATUS_COLORS["pending"];

                  return (
                    <React.Fragment key={order.code}>
                      <tr
                        style={{
                          borderTop: "1px solid var(--line)",
                          background: isExpanded ? "var(--creme)" : "transparent",
                          transition: "background .15s",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 14px",
                            fontFamily: "Oswald,sans-serif",
                            fontWeight: 700,
                            color: "var(--brasa)",
                            cursor: "pointer",
                          }}
                          onClick={() => setExpandedOrder(isExpanded ? null : order.code)}
                        >
                          #{order.code}
                        </td>
                        <td style={{ padding: "10px 8px", color: "var(--muted)" }}>
                          {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          {MODE_ICON[order.serviceMode] ?? "?"} {order.origin}
                          {order.operatorName && (
                            <small style={{ display: "block", color: "var(--muted)", fontSize: 10 }}>
                              por {order.operatorName}
                            </small>
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", color: "var(--muted)" }}>
                          {order.tableName ?? "—"}
                          {order.customerName ? ` · ${order.customerName}` : ""}
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "var(--creme)",
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            💳 {order.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background: STATUS_COLOR[order.status] + "22",
                              color: STATUS_COLOR[order.status],
                            }}
                          >
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                              background: fcfg.bg,
                              color: fcfg.color,
                              border: `1px solid ${fcfg.border}`,
                            }}
                          >
                            {FINANCIAL_STATUS_LABELS[finStatus] ?? finStatus}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 8px",
                            textAlign: "right",
                            fontWeight: 800,
                            color:
                              order.status === "cancelled"
                                ? "var(--muted)"
                                : "var(--chapa-900)",
                            textDecoration:
                              order.status === "cancelled" ? "line-through" : "none",
                          }}
                        >
                          {money(order.totalCents)}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                            {finStatus !== "paid" && order.status !== "cancelled" && (
                              <button
                                onClick={() => setReceivingOrder(order)}
                                style={{
                                  background: "#16a34a",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "4px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Baixa
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedOrder(isExpanded ? null : order.code)}
                              style={{
                                background: "#f1f5f9",
                                border: "1px solid var(--line)",
                                borderRadius: 6,
                                padding: "4px 8px",
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                            >
                              {isExpanded ? "Fechar" : "Detalhes"}
                            </button>
                            {order.status !== "cancelled" && (
                              <button
                                onClick={() =>
                                  setCancelRefundModal({
                                    type: "cancel_order",
                                    idOrCode: order.code,
                                    title: `Pedido #${order.code} · ${money(order.totalCents)}`,
                                  })
                                }
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  fontSize: 11,
                                  cursor: "pointer",
                                }}
                                title="Cancelar pedido"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Linha expandida de detalhes e pagamentos */}
                      {isExpanded && (
                        <tr style={{ background: "var(--creme)" }}>
                          <td colSpan={9} style={{ padding: "0 16px 14px 28px" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1.2fr 1.5fr",
                                gap: "1.5rem",
                                paddingTop: 8,
                              }}
                            >
                              {/* Itens */}
                              <div>
                                <strong
                                  style={{
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    color: "var(--muted)",
                                    letterSpacing: ".6px",
                                  }}
                                >
                                  Itens do pedido
                                </strong>
                                {items.map((item, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      padding: "4px 0",
                                      fontSize: 12,
                                      borderBottom: "1px dashed var(--line)",
                                    }}
                                  >
                                    <span>
                                      <b style={{ color: "var(--brasa)" }}>{item.quantity}×</b>{" "}
                                      {item.name}
                                      {item.observation && (
                                        <em style={{ color: "var(--muted)", fontSize: 10 }}>
                                          {" "}
                                          ↳ {item.observation}
                                        </em>
                                      )}
                                    </span>
                                    <span style={{ fontWeight: 700 }}>
                                      {money(item.unitPriceCents * item.quantity)}
                                    </span>
                                  </div>
                                ))}
                                {order.notes && (
                                  <p
                                    style={{
                                      margin: "8px 0 0",
                                      padding: "6px 8px",
                                      background: "white",
                                      borderRadius: 6,
                                      border: "1px dashed var(--line)",
                                      fontSize: 11,
                                    }}
                                  >
                                    📝 {order.notes}
                                  </p>
                                )}
                              </div>

                              {/* Histórico Real de Pagamentos */}
                              <div>
                                <strong
                                  style={{
                                    fontSize: 10,
                                    textTransform: "uppercase",
                                    color: "var(--muted)",
                                    letterSpacing: ".6px",
                                  }}
                                >
                                  Lançamentos Financeiros (Pagamentos Efetuados)
                                </strong>
                                {!order.payments || order.payments.length === 0 ? (
                                  <div
                                    style={{
                                      padding: "8px",
                                      background: "white",
                                      borderRadius: 6,
                                      border: "1px dashed var(--line)",
                                      fontSize: 11,
                                      color: "var(--muted)",
                                      marginTop: 4,
                                    }}
                                  >
                                    Nenhum pagamento baixado ainda. Pedido marcado como pendente.
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 6,
                                      marginTop: 4,
                                    }}
                                  >
                                    {order.payments.map((p) => (
                                      <div
                                        key={p.id}
                                        style={{
                                          background: "white",
                                          border: "1px solid var(--line)",
                                          borderRadius: 6,
                                          padding: "6px 10px",
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          fontSize: 11,
                                        }}
                                      >
                                        <div>
                                          <b>
                                            {methodLabelMap[p.method] || p.method} —{" "}
                                            {money(p.amountCents)}
                                          </b>
                                          {p.changeCents ? (
                                            <span style={{ color: "var(--muted)" }}>
                                              {" "}
                                              (Troco: {money(p.changeCents)})
                                            </span>
                                          ) : null}
                                          <small
                                            style={{
                                              display: "block",
                                              color: "var(--muted)",
                                              fontSize: 9,
                                            }}
                                          >
                                            {new Date(p.createdAt).toLocaleTimeString("pt-BR")}{" "}
                                            por {p.operatorName || "Operador"}
                                            {p.cardBrand ? ` · ${p.cardBrand}` : ""}
                                            {p.receiptRef ? ` · NSU: ${p.receiptRef}` : ""}
                                          </small>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                          <span
                                            style={{
                                              fontSize: 9,
                                              fontWeight: 800,
                                              padding: "2px 6px",
                                              borderRadius: 4,
                                              background:
                                                p.status === "confirmed" ? "#dcfce7" : "#fee2e2",
                                              color:
                                                p.status === "confirmed" ? "#166534" : "#991b1b",
                                            }}
                                          >
                                            {p.status === "confirmed" ? "CONFIRMADO" : "ESTORNADO"}
                                          </span>
                                          {p.status === "confirmed" && (
                                            <button
                                              onClick={() =>
                                                setCancelRefundModal({
                                                  type: "refund_payment",
                                                  idOrCode: p.id,
                                                  title: `Pagamento #${p.id} (${money(
                                                    p.amountCents
                                                  )}) de ${order.code}`,
                                                })
                                              }
                                              style={{
                                                background: "none",
                                                border: "1px solid #fecaca",
                                                color: "#dc2626",
                                                borderRadius: 4,
                                                padding: "2px 6px",
                                                fontSize: 10,
                                                cursor: "pointer",
                                              }}
                                            >
                                              Estornar
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Recebimento */}
      {receivingOrder && (
        <ReceivePaymentModal
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onSuccess={() => {
            ordersQuery.refetch();
            activeCashQuery.refetch();
          }}
          isOpenCashRegister={Boolean(activeCashQuery.data)}
        />
      )}

      {/* Modal de Cancelamento / Estorno com Justificativa */}
      {cancelRefundModal && (
        <CancelRefundModal
          type={cancelRefundModal.type}
          idOrCode={cancelRefundModal.idOrCode}
          title={cancelRefundModal.title}
          onClose={() => setCancelRefundModal(null)}
          onSuccess={() => {
            ordersQuery.refetch();
            activeCashQuery.refetch();
          }}
        />
      )}

      {/* Modal de Trilha de Auditoria */}
      {auditOpen && <AuditLogModal onClose={() => setAuditOpen(false)} />}
    </div>
  );
}

// ─── Reports Tab Component ──────────────────────────────────────────────────
function ReportsTab() {
  const [period, setPeriod] = useState<StatsPeriod>("day");
  const statsQuery = trpc.orders.stats.useQuery({ period });
  const stats = statsQuery.data;
  const periodLabel = { day: "Dia", week: "Semana", month: "Mês", year: "Ano" }[period];
  const barData = stats?.byDate.map((d) => ({ ...d, revenue: d.revenue / 100 })) ?? [];

  const exportReportCsv = () => {
    if (!stats) return;
    const rows = [
      ["Relatório de Vendas - Meu Chapa Burger"],
      [`Período: ${periodLabel}`],
      [""],
      ["Data", "Pedidos", "Receita (R$)"],
      ...stats.byDate.map((d) => [d.label, String(d.orders), (d.revenue / 100).toFixed(2)]),
      [""],
      ["Produtos Mais Vendidos"],
      ["Produto", "Quantidade", "Receita (R$)"],
      ...stats.topItems.map((item) => [
        `"${item.name}"`,
        String(item.qty),
        (item.revenue / 100).toFixed(2),
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Period filter */}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>
          Agrupar por:
        </span>
        {(["day", "week", "month", "year"] as StatsPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "6px 14px",
              borderRadius: "999px",
              border: "1px solid var(--line)",
              background: period === p ? "var(--chapa-900)" : "#fffaf0",
              color: period === p ? "var(--cheddar)" : "var(--muted)",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {{ day: "Dia", week: "Semana", month: "Mês", year: "Ano" }[p]}
          </button>
        ))}
        <button
          onClick={exportReportCsv}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            border: "1px solid var(--line)",
            background: "#ffffff",
            borderRadius: "7px",
            padding: "6px 12px",
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--chapa-900)",
            cursor: "pointer",
          }}
        >
          <FileSpreadsheet size={13} /> Exportar Relatório CSV
        </button>
        <button
          onClick={() => statsQuery.refetch()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            border: "1px solid var(--line)",
            background: "#fffaf0",
            borderRadius: "7px",
            padding: "6px 10px",
            fontSize: "11px",
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Revenue bar chart */}
      <div
        style={{
          background: "#fffdf9",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "1.25rem",
        }}
      >
        <h3
          style={{
            fontFamily: "Oswald,sans-serif",
            textTransform: "uppercase",
            fontSize: "18px",
            margin: "0 0 1rem",
            color: "var(--chapa-900)",
          }}
        >
          Receita Real por {periodLabel} (Pagamentos Confirmados)
        </h3>
        {statsQuery.isLoading ? (
          <div className="loading-state" style={{ minHeight: 200 }}>
            Carregando…
          </div>
        ) : barData.length === 0 ? (
          <div className="loading-state" style={{ minHeight: 200 }}>
            Sem dados no período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]} />
              <Bar dataKey="revenue" fill="var(--brasa)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top items table (stock usage) */}
      <div
        style={{
          background: "#fffdf9",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          padding: "1.25rem",
        }}
      >
        <h3
          style={{
            fontFamily: "Oswald,sans-serif",
            textTransform: "uppercase",
            fontSize: "18px",
            margin: "0 0 1rem",
            color: "var(--chapa-900)",
          }}
        >
          📦 Produtos mais vendidos
        </h3>
        {statsQuery.isLoading ? (
          <div className="loading-state" style={{ minHeight: 120 }}>
            Carregando…
          </div>
        ) : (stats?.topItems ?? []).length === 0 ? (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "12px",
              textAlign: "center",
              padding: "2rem 0",
            }}
          >
            Sem vendas registradas.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr
                style={{
                  color: "var(--muted)",
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: ".6px",
                }}
              >
                <th style={{ textAlign: "left", padding: "6px 0" }}>Produto</th>
                <th style={{ textAlign: "right", padding: "6px 0" }}>Qtd vendida</th>
                <th style={{ textAlign: "right", padding: "6px 0" }}>Receita</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.topItems ?? []).map((item, i) => (
                <tr key={i} style={{ borderTop: "1px dashed var(--line)" }}>
                  <td style={{ padding: "10px 0" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "var(--cheddar)",
                          color: "var(--chapa-950)",
                          fontSize: 9,
                          fontWeight: 900,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {i + 1}
                      </span>
                      {item.name}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{item.qty}×</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--brasa)" }}>
                    {money(item.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Operations Panel ────────────────────────────────────────────────────────
function Operations({ onBack }: { onBack: () => void }) {
  const auth = useAuth();
  const [tab, setTab] = useState<OpsTab>("orders");
  const [receivingOrder, setReceivingOrder] = useState<StoredOrder | null>(null);

  const ordersQuery = trpc.orders.list.useQuery(undefined, {
    enabled: Boolean(auth.isAuthenticated && auth.user?.role === "admin"),
    refetchInterval: 8000,
  });
  const activeCashQuery = trpc.cash.getActive.useQuery();

  const statusMutation = trpc.orders.setStatus.useMutation({
    onSuccess: () => ordersQuery.refetch(),
    onError: (err) => {
      alert(err.message);
    },
  });

  const columns: Array<{ status: OrderStatus; label: string; icon: string }> = [
    { status: "received", label: "Recebidos", icon: "🚨" },
    { status: "preparing", label: "Na chapa", icon: "🔥" },
    { status: "ready", label: "Prontos", icon: "✅" },
  ];

  // Dev login
  if (!auth.isAuthenticated) {
    const devLogin = async () => {
      try {
        const res = await fetch("/api/dev/login", { method: "POST" });
        if (!res.ok) {
          const e = await res.json();
          throw new Error(e.error);
        }
        window.location.reload();
      } catch (err) {
        window.alert("Dev login falhou: " + String(err));
      }
    };
    return (
      <section className="staff-gate">
        <LockKeyhole size={34} />
        <h1>Área da equipe</h1>
        <p>Entre com a conta da operação para acompanhar pedidos, cozinha e comandas.</p>
        <Button className="primary-button" onClick={() => startLogin()}>
          Entrar na operação
        </Button>
        {import.meta.env.DEV && (
          <>
            <hr style={{ width: "100%", margin: "8px 0", opacity: 0.2 }} />
            <span style={{ fontSize: "11px", opacity: 0.5 }}>modo desenvolvimento</span>
            <Button className="secondary-button" onClick={devLogin}>
              ⚙️ Entrar como Dev Admin
            </Button>
          </>
        )}
        <Button className="text-button" onClick={onBack}>
          Voltar ao cardápio
        </Button>
      </section>
    );
  }
  if (auth.user?.role !== "admin")
    return (
      <section className="staff-gate">
        <LockKeyhole size={34} />
        <h1>Acesso restrito</h1>
        <p>Esta conta está autenticada, mas ainda não tem permissão de operação.</p>
        <Button className="text-button" onClick={onBack}>
          Voltar ao cardápio
        </Button>
      </section>
    );

  const orders = (ordersQuery.data ?? []) as unknown as StoredOrder[];

  const handleAdvanceStatus = (order: StoredOrder, targetStatus: OrderStatus) => {
    // Trava de entrega: Bloquear entrega de balcão sem pagamento
    if (
      targetStatus === "completed" &&
      order.serviceMode === "counter" &&
      order.financialStatus !== "paid"
    ) {
      alert("Atenção: Pedido de balcão precisa estar pago antes de ser entregue. Abrindo recebimento...");
      setReceivingOrder(order);
      return;
    }

    statusMutation.mutate({ code: order.code, status: targetStatus });
  };

  return (
    <section className="operations">
      {/* Header */}
      <div className="operations-head">
        <div>
          <span className="eyebrow">painel da casa</span>
          <h1>Área da Equipe</h1>
          <p style={{ color: "var(--muted)", margin: "9px 0 0" }}>
            Pedidos, financeiro e relatórios em tempo real.
          </p>
        </div>
        <div className="operations-actions">
          <Button className="secondary-button" onClick={onBack}>
            Ver cardápio
          </Button>
          <Button className="dark-button" onClick={() => auth.logout()}>
            Sair
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="ops-kpis">
        <div>
          <span>Pedidos em aberto</span>
          <strong>
            {orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length}
          </strong>
        </div>
        <div>
          <span>Na chapa agora</span>
          <strong>{orders.filter((o) => o.status === "preparing").length}</strong>
        </div>
        <div>
          <span>Ticket médio hoje</span>
          <strong>
            {orders.length
              ? money(
                  Math.round(
                    orders.reduce((s, o) => s + o.totalCents, 0) / orders.length
                  )
                )
              : "R$ 0,00"}
          </strong>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: ".5rem",
          marginBottom: "1.5rem",
          borderBottom: "2px solid var(--line)",
          paddingBottom: ".75rem",
        }}
      >
        {(
          [
            ["orders", "🚨 Esteira"],
            ["financial", "💰 Financeiro & Caixa"],
            ["reports", "📊 Relatórios"],
          ] as [OpsTab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              borderRadius: "8px 8px 0 0",
              border: "none",
              background: tab === t ? "var(--chapa-900)" : "transparent",
              color: tab === t ? "var(--cheddar)" : "var(--muted)",
              fontSize: "12px",
              fontWeight: 800,
              cursor: "pointer",
              transition: "background .18s, color .18s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "orders" &&
        (ordersQuery.isLoading ? (
          <div className="loading-state">Carregando a fila da cozinha…</div>
        ) : (
          <div className="order-board">
            {columns.map((col) => (
              <div className="order-column" key={col.status}>
                <div className="column-head">
                  <h2>
                    {col.icon} {col.label}
                  </h2>
                  <span>{orders.filter((o) => o.status === col.status).length}</span>
                </div>
                {orders
                  .filter((o) => o.status === col.status)
                  .map((order) => {
                    const originIcon =
                      order.serviceMode === "customer"
                        ? "📱"
                        : order.serviceMode === "waiter"
                        ? "🧑‍🍳"
                        : "🧾";
                    const finStatus = order.financialStatus || "pending";
                    const fcfg =
                      FINANCIAL_STATUS_COLORS[finStatus] || FINANCIAL_STATUS_COLORS["pending"];

                    return (
                      <article
                        className="order-ticket"
                        key={order.code}
                        style={{
                          borderLeftColor:
                            order.serviceMode === "customer"
                              ? "#16a34a"
                              : order.serviceMode === "waiter"
                              ? "#d97706"
                              : "#2563eb",
                        }}
                      >
                        <div className="ticket-top">
                          <strong>#{order.code}</strong>
                          <span>
                            {new Date(order.createdAt).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="ticket-meta">
                          {originIcon} {order.origin}
                          {order.tableName ? ` · ${order.tableName}` : ""}
                          {order.customerName ? ` · ${order.customerName}` : ""}
                        </div>
                        <div className="ticket-items">
                          {(Array.isArray(order.items)
                            ? (order.items as Array<{
                                name: string;
                                quantity: number;
                                observation?: string;
                              }>)
                            : []
                          ).map((item, i) => (
                            <div key={i}>
                              <b>{item.quantity}×</b> {item.name}
                              {item.observation && <small>↳ {item.observation}</small>}
                            </div>
                          ))}
                        </div>
                        {order.notes && <div className="ticket-note">Obs.: {order.notes}</div>}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            margin: "8px 0 4px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "10px",
                              color: "var(--muted)",
                              padding: "2px 6px",
                              background: "var(--creme)",
                              borderRadius: "999px",
                            }}
                          >
                            💳 {order.paymentMethod}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: 999,
                              background: fcfg.bg,
                              color: fcfg.color,
                              border: `1px solid ${fcfg.border}`,
                            }}
                          >
                            {FINANCIAL_STATUS_LABELS[finStatus] || finStatus}
                          </span>
                        </div>

                        <div className="ticket-bottom">
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <strong>{money(order.totalCents)}</strong>
                            {finStatus !== "paid" && (
                              <button
                                onClick={() => setReceivingOrder(order)}
                                style={{
                                  background: "#16a34a",
                                  color: "white",
                                  border: "none",
                                  borderRadius: 6,
                                  padding: "3px 8px",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Baixa
                              </button>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <button
                              className="icon-button small"
                              onClick={() => printOrder(order)}
                              title="Imprimir comanda"
                            >
                              <Printer size={15} />
                            </button>
                            {col.status !== "ready" ? (
                              <button
                                className="advance-button"
                                onClick={() =>
                                  handleAdvanceStatus(
                                    order,
                                    col.status === "received" ? "preparing" : "ready"
                                  )
                                }
                              >
                                <ChevronRight size={15} />
                              </button>
                            ) : (
                              <button
                                className="complete-button"
                                onClick={() => handleAdvanceStatus(order, "completed")}
                              >
                                <Check size={15} /> Entregue
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
              </div>
            ))}
          </div>
        ))}

      {tab === "financial" && <FinancialTab />}
      {tab === "reports" && <ReportsTab />}

      {/* Modal de Baixa Direto da Esteira */}
      {receivingOrder && (
        <ReceivePaymentModal
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onSuccess={() => ordersQuery.refetch()}
          isOpenCashRegister={Boolean(activeCashQuery.data)}
        />
      )}
    </section>
  );
}

// ─── Home Principal ──────────────────────────────────────────────────────────
export default function Home() {
  const menuQuery = trpc.menu.list.useQuery();
  const createOrder = trpc.orders.create.useMutation();
  const { user, isAuthenticated } = useAuth();

  const [activeView, setActiveView] = useState<"mode-select" | "order" | "ops">("mode-select");
  const [serviceMode, setServiceMode] = useState<ServiceMode>("customer");
  const [category, setCategory] = useState<MenuCategory | "Todos">("Todos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [tableName, setTableName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Na entrega / fechamento");
  const [notes, setNotes] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);

  const menu = menuQuery.data ?? [];
  const visibleMenu = useMemo(
    () => (category === "Todos" ? menu : menu.filter((i) => i.category === category)),
    [category, menu]
  );

  const addLine = (item: MenuItem, quantity = 1, observation = "") =>
    setCart((lines) => {
      const key = `${item.id}-${observation.trim()}`;
      const ex = lines.find((l) => `${l.id}-${l.observation}` === key);
      if (ex)
        return lines.map((l) =>
          `${l.id}-${l.observation}` === key ? { ...l, quantity: l.quantity + quantity } : l
        );
      return [...lines, { ...item, quantity, observation: observation.trim() }];
    });
  const changeLine = (line: CartLine, qty: number) =>
    setCart((lines) =>
      qty <= 0
        ? lines.filter((i) => !(i.id === line.id && i.observation === line.observation))
        : lines.map((i) =>
            i.id === line.id && i.observation === line.observation ? { ...i, quantity: qty } : i
          )
    );
  const total = cart.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  const submitOrder = () => {
    const originMap: Record<ServiceMode, string> = {
      customer: "Cliente via QR Code",
      waiter: "Garçom / Mesa",
      counter: "Balcão",
    };
    createOrder.mutate(
      {
        origin: originMap[serviceMode],
        serviceMode,
        tableName: tableName || undefined,
        customerName: customerName || undefined,
        paymentMethod,
        notes: notes || undefined,
        items: cart.map((i) => ({
          productId: i.id,
          name: i.name,
          category: i.category,
          quantity: i.quantity,
          unitPriceCents: i.priceCents,
          observation: i.observation,
        })),
      },
      {
        onSuccess: (data) => {
          setConfirmationCode(data.order.code);
          setCart([]);
          setCheckoutOpen(false);
        },
        onError: (err) => window.alert(err.message),
      }
    );
  };

  // Mode selector screen
  if (activeView === "mode-select") {
    return (
      <ServiceModePicker
        onSelect={(mode) => {
          setServiceMode(mode);
          setActiveView("order");
        }}
        onOps={() => setActiveView("ops")}
      />
    );
  }

  if (activeView === "ops") return <Operations onBack={() => setActiveView("mode-select")} />;

  if (confirmationCode)
    return (
      <main className="site-shell">
        <header className="site-header">
          <Logo />
          <span className="header-note">A chapa está trabalhando.</span>
        </header>
        <Confirmation
          code={confirmationCode}
          onNewOrder={() => setConfirmationCode(null)}
        />
      </main>
    );

  const cfg = MODE_CONFIG[serviceMode];

  return (
    <main className="site-shell">
      <header className="site-header">
        <Logo />
        <nav className="desktop-nav">
          <a href="#cardapio">Cardápio</a>
          <a href="#nossa-chapa">Nossa chapa</a>
          <button onClick={() => setActiveView("ops")}>Área da equipe</button>
        </nav>
        <div className="header-actions">
          <span className="header-note">
            {isAuthenticated && user?.role === "admin"
              ? `Olá, ${user.name?.split(" ")[0] ?? "equipe"}`
              : "Feito na hora"}
          </span>
          <ModeBadge mode={serviceMode} onSwitch={() => setActiveView("mode-select")} />
          <button className="header-bag" onClick={() => setCheckoutOpen(true)}>
            <ShoppingBag size={18} />
            <span>{cart.reduce((s, i) => s + i.quantity, 0)}</span>
          </button>
        </div>
      </header>

      {/* Waiter bar: shows table/customer name persistently */}
      {serviceMode === "waiter" && (
        <WaiterBar
          tableName={tableName}
          customerName={customerName}
          onChange={(t, c) => {
            setTableName(t);
            setCustomerName(c);
          }}
        />
      )}

      {/* Counter mode top bar */}
      {serviceMode === "counter" && (
        <div
          style={{
            background: "#eff6ff",
            borderBottom: "2px solid #93c5fd",
            padding: ".5rem clamp(20px,8vw,140px)",
            display: "flex",
            alignItems: "center",
            gap: ".75rem",
          }}
        >
          <MonitorSmartphone size={15} style={{ color: "#2563eb" }} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              color: "#2563eb",
              textTransform: "uppercase",
              letterSpacing: ".8px",
            }}
          >
            Modo Balcão — Atendimento rápido
          </span>
        </div>
      )}

      {/* Hero */}
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Sparkles size={15} /> a chapa acesa
          </span>
          {serviceMode === "customer" && <h1>O artesanal que chega quente na sua fome.</h1>}
          {serviceMode === "waiter" && <h1>Pedido do garçom. Mesa atendida.</h1>}
          {serviceMode === "counter" && <h1>Balcão. Rápido e preciso.</h1>}
          <p>
            {serviceMode === "customer"
              ? "Hambúrguer, baguete, frita e shake feitos do nosso jeito — com ingrediente de verdade e a chapa trabalhando."
              : serviceMode === "waiter"
              ? "Registre o pedido da mesa abaixo. Preencha mesa e cliente na barra amarela acima para identificar a comanda."
              : "Atendimento ágil no balcão. Selecione os itens e confirme o pedido rapidamente."}
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#cardapio">
              Ver cardápio <ArrowRight size={18} />
            </a>
            {serviceMode === "customer" && (
              <a className="hero-link" href="#nossa-chapa">
                Conhecer a casa <ChevronRight size={17} />
              </a>
            )}
          </div>
          <div className="hero-proof">
            <span>
              <Flame size={16} /> Feito na chapa
            </span>
            <span>
              <Clock3 size={16} /> Pedido direto
            </span>
            <span>
              <ChefHat size={16} /> Molho da casa
            </span>
            <span style={{ color: cfg.accent, fontWeight: 800 }}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-burger">🍔</div>
          <div className="hero-stamp">
            MEU
            <br />
            CHAPA<em>Burger</em>
          </div>
        </div>
      </section>

      {/* Category strip */}
      <section className="category-strip" id="cardapio">
        <div className="section-intro">
          <span className="eyebrow">escolha a sua mordida</span>
          <h2>Cardápio da casa</h2>
        </div>
        <div className="category-scroll">
          <button
            className={category === "Todos" ? "active" : ""}
            onClick={() => setCategory("Todos")}
          >
            🔥 Tudo
          </button>
          {MENU_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={category === cat ? "active" : ""}
              onClick={() => setCategory(cat)}
            >
              {categoryEmoji[cat]} {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="menu-layout">
        <div className="menu-grid">
          {menuQuery.isLoading ? (
            <div className="loading-state">Acendendo a chapa…</div>
          ) : (
            visibleMenu.map((item) => (
              <ProductCard key={item.id} item={item} onAdd={setSelectedItem} />
            ))
          )}
        </div>
        <Cart cart={cart} onChange={changeLine} onCheckout={() => setCheckoutOpen(true)} />
      </section>

      {/* Story section (hidden in counter mode for speed) */}
      {serviceMode !== "counter" && (
        <section className="story-section" id="nossa-chapa">
          <div>
            <span className="eyebrow">como a gente faz</span>
            <h2>Não é só montar um lanche.</h2>
            <p>
              É escolher o pão, acertar o molho, selar na chapa e mandar quente para você. O Meu
              Chapa nasceu para servir comida com cara de casa e atitude de quem conhece a própria
              cozinha.
            </p>
            <div className="story-points">
              <span>
                <b>01</b> Ingrediente com propósito
              </span>
              <span>
                <b>02</b> Montagem caprichada
              </span>
              <span>
                <b>03</b> Chapa no ponto
              </span>
            </div>
          </div>
          <div className="story-card">
            <div className="story-card-mark">🍔</div>
            <strong>
              Feito na chapa.
              <br />
              Montado do seu jeito.
            </strong>
            <span>Meu Chapa Burger</span>
          </div>
        </section>
      )}

      <footer className="site-footer">
        <Logo compact />
        <div>
          <span>Pedido direto</span>
          <span>Comanda detalhada</span>
          <span>Feito na hora</span>
        </div>
        <small>© {new Date().getFullYear()} Meu Chapa Burger. Todos os direitos reservados.</small>
      </footer>

      <ProductDialog item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addLine} />

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="modal-backdrop" onMouseDown={() => setCheckoutOpen(false)}>
          <div className="modal-card checkout-card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">quase na mordida</span>
                <h2>Revisar pedido</h2>
                {/* Mode indicator in checkout */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 6,
                    padding: "3px 10px",
                    borderRadius: "999px",
                    background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    color: cfg.accent,
                    fontSize: "10px",
                    fontWeight: 800,
                  }}
                >
                  {cfg.icon} {cfg.label}
                </div>
              </div>
              <button className="icon-button" onClick={() => setCheckoutOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Cart summary */}
            <div className="checkout-summary">
              {cart.map((item) => (
                <div key={`${item.id}-${item.observation}`}>
                  <span>
                    {item.quantity}× {item.name}
                    {item.observation && <small>↳ {item.observation}</small>}
                  </span>
                  <strong>{money(item.priceCents * item.quantity)}</strong>
                </div>
              ))}
              <div className="checkout-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
            </div>

            {/* Mode-specific fields */}
            {serviceMode === "waiter" && (
              <div className="form-grid">
                <label className="field-label">
                  Mesa / identificação
                  <input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="Ex.: Mesa 08"
                  />
                </label>
                <label className="field-label">
                  Nome do cliente
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex.: João"
                  />
                </label>
              </div>
            )}
            {serviceMode === "counter" && (
              <label className="field-label">
                Nome / senha de retirada
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ex.: Senha 42 / Maria"
                />
              </label>
            )}

            {/* Payment method */}
            <label className="field-label">
              💳 Intenção de Pagamento
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="Na entrega / fechamento">Na entrega / fechamento</option>
                <option value="Pix">Pix</option>
                <option value="Cartão Crédito">Cartão Crédito</option>
                <option value="Cartão Débito">Cartão Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Vale Refeição">Vale Refeição</option>
              </select>
            </label>

            <label className="field-label">
              Observação da comanda
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: chamar no balcão, separar molhos..."
                rows={2}
              />
            </label>

            <Button
              className="primary-button full"
              disabled={createOrder.isPending || cart.length === 0}
              onClick={submitOrder}
            >
              {createOrder.isPending ? "Enviando para a chapa…" : "Enviar pedido"}{" "}
              <ArrowRight size={17} />
            </Button>
            <p className="secure-note">
              <CircleDollarSign size={15} /> Preço confirmado no servidor e pedido registrado com
              código único.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

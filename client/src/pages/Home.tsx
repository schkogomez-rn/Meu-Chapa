import { useMemo, useState } from "react";
import {
  ArrowRight, Check, ChefHat, ChevronRight, CircleDollarSign, Clock3,
  Flame, LockKeyhole, Minus, MonitorSmartphone, Plus, Printer,
  QrCode, ReceiptText, RefreshCw, ShoppingBag, Sparkles,
  TrendingUp, Users, Wallet, X,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { MENU_CATEGORIES, type MenuCategory, type MenuItem } from "../../../shared/menu";
import { trpc } from "@/lib/trpc";

// ─── Helpers ────────────────────────────────────────────────────────────────
const money = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const categoryEmoji: Record<MenuCategory, string> = {
  Combos: "🍔", Hambúrgueres: "🥩", Baguetes: "🥖", Tradicionais: "🧀",
  Fritas: "🍟", "Milk-shakes": "🥤", Bebidas: "🧃", Adicionais: "✨",
};
const categoryClass: Record<MenuCategory, string> = {
  Combos: "combo", Hambúrgueres: "burger", Baguetes: "baguette",
  Tradicionais: "traditional", Fritas: "fries", "Milk-shakes": "shake",
  Bebidas: "drink", Adicionais: "extra",
};

type CartLine = MenuItem & { quantity: number; observation: string };
type ServiceMode = "customer" | "waiter" | "counter";
type OrderStatus = "received" | "preparing" | "ready" | "completed" | "cancelled";
type OpsTab = "orders" | "financial" | "reports";
type StatsPeriod = "day" | "week" | "month" | "year";

type StoredOrder = {
  code: string; origin: string; serviceMode: string; tableName: string | null;
  customerName: string | null; paymentMethod: string; notes: string | null;
  items: unknown; totalCents: number; status: OrderStatus; createdAt: string | Date;
};

const MODE_CONFIG = {
  customer: { icon: <QrCode size={28} />, label: "Cliente", desc: "Pedido via QR Code", accent: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  waiter:   { icon: <Users size={28} />,  label: "Garçom",  desc: "Pedido por mesa",    accent: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  counter:  { icon: <MonitorSmartphone size={28} />, label: "Balcão", desc: "Atendimento rápido", accent: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
} as const;

const PIE_COLORS = ["#f07b17", "#ffc400", "#5c823b", "#2563eb", "#d97706", "#16a34a", "#9333ea", "#e11d48"];

// ─── Sub-components ──────────────────────────────────────────────────────────
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-lockup ${compact ? "compact" : ""}`}><div className="brand-mark">🍔</div><div><strong>MEU CHAPA</strong><em>Burger</em></div></div>;
}

function FoodArt({ item, large = false }: { item: MenuItem; large?: boolean }) {
  return <div className={`food-art ${categoryClass[item.category]} ${large ? "large" : ""}`}><span>{categoryEmoji[item.category]}</span><small>{item.tags?.[0] ?? "feito na chapa"}</small></div>;
}

function ProductCard({ item, onAdd }: { item: MenuItem; onAdd: (item: MenuItem) => void }) {
  return <article className="product-card">
    <FoodArt item={item} />
    <div className="product-card-body">
      <div className="eyebrow-row"><span>{item.category}</span>{item.tags?.[0] && <b>{item.tags[0]}</b>}</div>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <div className="product-card-footer"><strong>{money(item.priceCents)}</strong><button className="add-button" onClick={() => onAdd(item)}><Plus size={16} /> Adicionar</button></div>
    </div>
  </article>;
}

function ProductDialog({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (item: MenuItem, quantity: number, observation: string) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  if (!item) return null;
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">personalize sua mordida</span><h2>{item.name}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>
      <FoodArt item={item} large />
      <p className="modal-description">{item.description}</p>
      <label className="field-label">Quantidade<div className="quantity-control"><button onClick={() => setQuantity(v => Math.max(1, v - 1))}><Minus size={16} /></button><strong>{quantity}</strong><button onClick={() => setQuantity(v => v + 1)}><Plus size={16} /></button></div></label>
      <label className="field-label">Observação para a chapa<textarea value={observation} onChange={e => setObservation(e.target.value)} placeholder="Ex.: sem cebola, molho separado, bem passado..." rows={3} /></label>
      <Button className="primary-button full" onClick={() => { onAdd(item, quantity, observation); onClose(); }}>Adicionar à comanda <ArrowRight size={17} /></Button>
    </div>
  </div>;
}

function Cart({ cart, onChange, onCheckout }: { cart: CartLine[]; onChange: (line: CartLine, qty: number) => void; onCheckout: () => void }) {
  const total = cart.reduce((s, i) => s + i.priceCents * i.quantity, 0);
  return <aside className="cart-panel">
    <div className="cart-panel-head"><div><span className="eyebrow">sua comanda</span><h2>Na chapa</h2></div><span className="cart-count">{cart.reduce((s, i) => s + i.quantity, 0)} itens</span></div>
    {cart.length === 0 ? <div className="cart-empty"><ReceiptText size={30} /><strong>Sua chapa está esperando um pedido.</strong><span>Escolha um item do cardápio para começar.</span></div>
      : <div className="cart-lines">{cart.map(line => <div className="cart-line" key={`${line.id}-${line.observation}`}><div className="cart-line-info"><strong>{line.quantity}× {line.name}</strong>{line.observation && <span>↳ {line.observation}</span>}<small>{money(line.priceCents)} cada</small></div><div className="cart-line-actions"><strong>{money(line.priceCents * line.quantity)}</strong><div className="quantity-control mini"><button onClick={() => onChange(line, line.quantity - 1)}><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => onChange(line, line.quantity + 1)}><Plus size={13} /></button></div></div></div>)}</div>}
    <div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div>
    <Button className="primary-button full" disabled={!cart.length} onClick={onCheckout}>Revisar pedido <ArrowRight size={17} /></Button>
  </aside>;
}

function Confirmation({ code, onNewOrder }: { code: string; onNewOrder: () => void }) {
  const query = trpc.orders.get.useQuery({ code }, { refetchInterval: 10000 });
  const order = query.data;
  const labels: Record<OrderStatus, string> = { received: "Pedido recebido", preparing: "Na chapa", ready: "Pronto para sair", completed: "Entregue", cancelled: "Cancelado" };
  return <section className="confirmation-card"><div className="confirmation-icon"><Check size={30} /></div><span className="eyebrow">pedido enviado</span><h1>Deixa com a chapa.</h1><p>Seu pedido <strong>#{code}</strong> foi registrado. A cozinha já recebeu os detalhes.</p><div className="order-status"><span className="status-dot" />{order ? labels[order.status] : "Confirmando na cozinha"}</div><div className="status-steps"><span className={order?.status !== "cancelled" ? "active" : ""}><ReceiptText size={16} /> Recebido</span><span className={["preparing","ready","completed"].includes(order?.status ?? "") ? "active" : ""}><Flame size={16} /> Na chapa</span><span className={["ready","completed"].includes(order?.status ?? "") ? "active" : ""}><Check size={16} /> Pronto</span></div><Button className="secondary-button" onClick={onNewOrder}>Fazer outro pedido</Button></section>;
}

// ─── Mode Selector ───────────────────────────────────────────────────────────
function ServiceModePicker({ onSelect, onOps }: { onSelect: (m: ServiceMode) => void; onOps: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--chapa-950)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", marginBottom: "3rem", color: "#fff" }}>
        <Logo />
        <p style={{ color: "#cdb899", marginTop: "1rem", fontSize: "14px" }}>Selecione o modo de atendimento para continuar</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.25rem", maxWidth: "700px", width: "100%" }}>
        {(Object.entries(MODE_CONFIG) as [ServiceMode, typeof MODE_CONFIG.customer][]).map(([mode, cfg]) => (
          <button key={mode} onClick={() => onSelect(mode)} style={{ padding: "2rem 1.5rem", border: `2px solid ${cfg.border}`, borderRadius: "1rem", background: cfg.bg, cursor: "pointer", textAlign: "center", transition: "transform .18s, box-shadow .18s", boxShadow: "0 4px 16px rgba(0,0,0,.14)", display: "flex", flexDirection: "column", alignItems: "center", gap: ".75rem" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-6px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(0,0,0,.22)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,.14)"; }}>
            <div style={{ color: cfg.accent, padding: ".75rem", background: "white", borderRadius: "50%", boxShadow: `0 0 0 4px ${cfg.border}` }}>{cfg.icon}</div>
            <strong style={{ fontSize: "1.1rem", color: cfg.accent }}>{cfg.label}</strong>
            <span style={{ fontSize: "12px", color: "#666" }}>{cfg.desc}</span>
          </button>
        ))}
      </div>
      <button onClick={onOps} style={{ marginTop: "2.5rem", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", color: "#cdb899", borderRadius: ".5rem", padding: ".625rem 1.25rem", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: ".5rem" }}>
        <LockKeyhole size={14} /> Área da equipe
      </button>
    </div>
  );
}

// ─── Mode Badge (header) ─────────────────────────────────────────────────────
function ModeBadge({ mode, onSwitch }: { mode: ServiceMode; onSwitch: () => void }) {
  const cfg = MODE_CONFIG[mode];
  return (
    <button onClick={onSwitch} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: ".35rem .75rem", borderRadius: "999px", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.accent, fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
      {cfg.icon} {cfg.label} <ChevronRight size={13} />
    </button>
  );
}

// ─── Waiter Table Bar ────────────────────────────────────────────────────────
function WaiterBar({ tableName, customerName, onChange }: { tableName: string; customerName: string; onChange: (t: string, c: string) => void }) {
  return (
    <div style={{ background: "#fffbeb", borderBottom: "2px solid #fcd34d", padding: ".625rem clamp(20px,8vw,140px)", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", fontWeight: 800, color: "#d97706", textTransform: "uppercase", letterSpacing: ".8px", whiteSpace: "nowrap" }}>🧑‍🍳 Pedido Garçom</span>
      <label style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: "12px", color: "#92400e" }}>
        Mesa:
        <input value={tableName} onChange={e => onChange(e.target.value, customerName)} placeholder="Nº da mesa" style={{ border: "1px solid #fcd34d", borderRadius: "6px", padding: "4px 8px", fontSize: "12px", width: "110px", background: "white" }} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: "12px", color: "#92400e" }}>
        Cliente:
        <input value={customerName} onChange={e => onChange(tableName, e.target.value)} placeholder="Nome (opcional)" style={{ border: "1px solid #fcd34d", borderRadius: "6px", padding: "4px 8px", fontSize: "12px", width: "140px", background: "white" }} />
      </label>
    </div>
  );
}

// ─── Printing ────────────────────────────────────────────────────────────────
function printOrder(order: StoredOrder) {
  const items = Array.isArray(order.items) ? order.items as Array<{ name: string; quantity: number; unitPriceCents: number; observation?: string }> : [];
  const itemHtml = items.map(i => `<div class="r-item"><span><b>${i.quantity}×</b> ${i.name}${i.observation ? `<small>↳ ${i.observation}</small>` : ""}</span><strong>${money(i.unitPriceCents * i.quantity)}</strong></div>`).join("");
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) return;
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comanda ${order.code}</title><style>@page{size:80mm auto;margin:4mm}body{font-family:Arial,sans-serif;width:72mm;margin:0;color:#111;font-size:12px}.head{text-align:center;border-bottom:2px dashed #111;padding-bottom:8px;margin-bottom:8px}.brand{font-size:20px;font-weight:900;letter-spacing:1px}.meta{line-height:1.5;border-bottom:1px dashed #111;padding-bottom:8px}.r-item{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #999;padding:7px 0}.r-item span{max-width:52mm}.r-item small{display:block;font-size:10px;margin-top:3px}.total{display:flex;justify-content:space-between;font-size:17px;font-weight:900;border-top:2px solid #111;margin-top:8px;padding-top:8px}.note{border:1px solid #111;padding:6px;margin-top:8px;font-size:11px}.foot{text-align:center;border-top:2px dashed #111;margin-top:12px;padding-top:8px;font-size:10px}</style></head><body><div class="head"><div class="brand">MEU CHAPA</div><div>COMANDA DE PEDIDO</div><div>Pedido #${order.code}</div></div><div class="meta"><b>Origem:</b> ${order.origin}<br><b>Mesa:</b> ${order.tableName || "—"}${order.customerName ? `<br><b>Cliente:</b> ${order.customerName}` : ""}<br><b>Pagamento:</b> ${order.paymentMethod}</div>${itemHtml}<div class="total"><span>TOTAL</span><span>${money(order.totalCents)}</span></div>${order.notes ? `<div class="note"><b>OBSERVAÇÃO</b><br>${order.notes}</div>` : ""}<div class="foot">Feito na chapa. Montado do seu jeito.</div></body></html>`);
  popup.document.close(); popup.focus(); setTimeout(() => popup.print(), 240);
}

// ─── Payment Methods Config (localStorage) ───────────────────────────────────
const ALL_PAYMENT_METHODS = [
  "Pix", "Cartão Crédito", "Cartão Débito", "Dinheiro", "Na entrega / fechamento", "Vale Refeição",
];

function loadActiveMethods(): string[] {
  try {
    const raw = localStorage.getItem("meu-chapa:payment-methods");
    if (raw) return JSON.parse(raw);
  } catch {}
  return ALL_PAYMENT_METHODS;
}

function saveActiveMethods(methods: string[]) {
  localStorage.setItem("meu-chapa:payment-methods", JSON.stringify(methods));
}

// ─── Financial Tab ───────────────────────────────────────────────────────────
type FinancialPeriod = "today" | "yesterday" | "week" | "month";

function getPeriodRange(period: FinancialPeriod): { start: Date; end: Date; label: string } {
  const now = new Date();
  const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOf   = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (period === "today") {
    return { start: startOf(now), end: endOf(now), label: "Hoje" };
  }
  if (period === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { start: startOf(y), end: endOf(y), label: "Ontem" };
  }
  if (period === "week") {
    const s = new Date(now); s.setDate(s.getDate() - 6);
    return { start: startOf(s), end: endOf(now), label: "Últimos 7 dias" };
  }
  const s = new Date(now); s.setDate(1);
  return { start: startOf(s), end: endOf(now), label: "Este mês" };
}

const STATUS_LABELS: Record<string, string> = {
  received: "Recebido", preparing: "Na chapa", ready: "Pronto",
  completed: "Entregue", cancelled: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  received: "#d97706", preparing: "#f07b17", ready: "#2563eb",
  completed: "#16a34a", cancelled: "#6b7280",
};
const MODE_ICON: Record<string, string> = { customer: "📱", waiter: "🧑‍🍳", counter: "🧾" };

function FinancialTab() {
  const [activeMethods, setActiveMethods] = useState<string[]>(loadActiveMethods);
  const [period, setPeriod] = useState<FinancialPeriod>("today");
  const [configOpen, setConfigOpen] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const range = getPeriodRange(period);

  const ordersQuery = trpc.orders.listByPeriod.useQuery(
    { start: range.start.toISOString(), end: range.end.toISOString() },
    { refetchInterval: 30000 },
  );

  const periodOrders = ordersQuery.data ?? [];
  const activeOrders = periodOrders.filter(o => o.status !== "cancelled");

  // Derived financials from the period orders
  const totalRevenue = activeOrders.reduce((s, o) => s + o.totalCents, 0);
  const avgTicket = activeOrders.length ? Math.round(totalRevenue / activeOrders.length) : 0;
  const pending = periodOrders.filter(o => !["completed", "cancelled"].includes(o.status)).length;

  const byPayment: Array<{ name: string; count: number; revenue: number; value: number }> = [];
  for (const o of activeOrders) {
    const ex = byPayment.find(p => p.name === o.paymentMethod);
    if (ex) { ex.count++; ex.revenue += o.totalCents; ex.value += o.totalCents; }
    else byPayment.push({ name: o.paymentMethod, count: 1, revenue: o.totalCents, value: o.totalCents });
  }
  byPayment.sort((a, b) => b.revenue - a.revenue);

  const toggleMethod = (m: string) => {
    const next = activeMethods.includes(m) ? activeMethods.filter(x => x !== m) : [...activeMethods, m];
    setActiveMethods(next);
    saveActiveMethods(next);
  };

  const card = (title: string, value: string, sub?: string) => (
    <div style={{ background: "var(--chapa-900)", color: "#fff3df", borderRadius: 11, padding: "18px 20px" }}>
      <span style={{ display: "block", color: "#c9b18e", fontSize: 10, textTransform: "uppercase", letterSpacing: ".7px" }}>{title}</span>
      <strong style={{ display: "block", color: "var(--cheddar)", fontFamily: "Oswald,sans-serif", fontSize: 30, marginTop: 6 }}>{value}</strong>
      {sub && <span style={{ fontSize: 10, color: "#a88e6a" }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Configurar Formas de Pagamento ── */}
      <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <button onClick={() => setConfigOpen(o => !o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", background: "none", border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, color: "var(--chapa-900)" }}>
          <span>⚙️ Formas de pagamento aceitas</span>
          <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>{activeMethods.length} ativas — clique para {configOpen ? "fechar" : "configurar"}</span>
        </button>
        {configOpen && (
          <div style={{ borderTop: "1px solid var(--line)", padding: "16px 18px", display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {ALL_PAYMENT_METHODS.map(m => {
              const active = activeMethods.includes(m);
              return (
                <button key={m} onClick={() => toggleMethod(m)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: `1.5px solid ${active ? "var(--brasa)" : "var(--line)"}`, background: active ? "var(--chapa-900)" : "#fffaf0", color: active ? "var(--cheddar)" : "var(--muted)", fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all .18s" }}>
                  {active ? "✓" : "○"} {m}
                </button>
              );
            })}
            <p style={{ width: "100%", margin: "8px 0 0", fontSize: 10, color: "var(--muted)" }}>
              As formas ativas aparecem no checkout. Alterações salvas automaticamente no navegador.
            </p>
          </div>
        )}
      </div>

      {/* ── Filtro de Período ── */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginRight: 4 }}>Período:</span>
        {(["today","yesterday","week","month"] as FinancialPeriod[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: "7px 16px", borderRadius: 999, border: "1px solid var(--line)", background: period === p ? "var(--chapa-900)" : "#fffaf0", color: period === p ? "var(--cheddar)" : "var(--muted)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>
            {getPeriodRange(p).label}
          </button>
        ))}
        {ordersQuery.isFetching && <span style={{ fontSize: 10, color: "var(--muted)" }}>Atualizando…</span>}
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {card("Receita " + range.label, money(totalRevenue))}
        {card("Pedidos", String(activeOrders.length), `${pending} em aberto`)}
        {card("Ticket Médio", money(avgTicket))}
        {card("Cancelados", String(periodOrders.filter(o => o.status === "cancelled").length))}
      </div>

      {/* ── Breakdown + Pie ── */}
      {byPayment.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
          {/* Pie */}
          <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 12, padding: "1.25rem" }}>
            <h3 style={{ fontFamily: "Oswald,sans-serif", textTransform: "uppercase", fontSize: 17, margin: "0 0 1rem", color: "var(--chapa-900)" }}>Por forma de pagamento</h3>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart><Pie data={byPayment} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}>
                {byPayment.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie><Tooltip formatter={(v: number) => money(v)} /><Legend /></PieChart>
            </ResponsiveContainer>
          </div>
          {/* Table */}
          <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 12, padding: "1.25rem" }}>
            <h3 style={{ fontFamily: "Oswald,sans-serif", textTransform: "uppercase", fontSize: 17, margin: "0 0 1rem", color: "var(--chapa-900)" }}>Detalhamento</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".6px" }}>
                <th style={{ textAlign: "left", padding: "5px 0" }}>Forma</th>
                <th style={{ textAlign: "right", padding: "5px 0" }}>Pedidos</th>
                <th style={{ textAlign: "right", padding: "5px 0" }}>Total</th>
              </tr></thead>
              <tbody>{byPayment.map((p, i) => (
                <tr key={i} style={{ borderTop: "1px dashed var(--line)" }}>
                  <td style={{ padding: "10px 0", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />
                    {p.name}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{p.count}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--brasa)" }}>{money(p.revenue)}</td>
                </tr>
              ))}</tbody>
              <tfoot><tr style={{ borderTop: "2px solid var(--line)" }}>
                <td style={{ padding: "10px 0", fontWeight: 800 }}>Total</td>
                <td style={{ textAlign: "right", fontWeight: 800 }}>{activeOrders.length}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: "var(--brasa)", fontSize: 15 }}>{money(totalRevenue)}</td>
              </tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Todos os pedidos do período ── */}
      <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontFamily: "Oswald,sans-serif", textTransform: "uppercase", fontSize: 17, margin: 0, color: "var(--chapa-900)" }}>
            📋 Todos os pedidos — {range.label}
          </h3>
          <span style={{ background: "var(--creme)", color: "var(--muted)", padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800 }}>{periodOrders.length} pedidos</span>
        </div>

        {ordersQuery.isLoading ? (
          <div className="loading-state">Carregando pedidos…</div>
        ) : periodOrders.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", padding: "2.5rem" }}>Nenhum pedido neste período.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, background: "#f7f0e6" }}>
              <tr style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: ".6px" }}>
                <th style={{ textAlign: "left",   padding: "8px 16px" }}>Código</th>
                <th style={{ textAlign: "left",   padding: "8px 8px"  }}>Hora</th>
                <th style={{ textAlign: "left",   padding: "8px 8px"  }}>Origem</th>
                <th style={{ textAlign: "left",   padding: "8px 8px"  }}>Mesa / Cliente</th>
                <th style={{ textAlign: "left",   padding: "8px 8px"  }}>Pagamento</th>
                <th style={{ textAlign: "center", padding: "8px 8px"  }}>Status</th>
                <th style={{ textAlign: "right",  padding: "8px 16px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {periodOrders.map(order => {
                const items = Array.isArray(order.items)
                  ? order.items as Array<{ name: string; quantity: number; unitPriceCents: number; observation?: string }>
                  : [];
                const isExpanded = expandedOrder === order.code;
                return (
                  <>
                    <tr key={order.code}
                      onClick={() => setExpandedOrder(isExpanded ? null : order.code)}
                      style={{ borderTop: "1px solid var(--line)", cursor: "pointer", background: isExpanded ? "var(--creme)" : "transparent", transition: "background .15s" }}
                      onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "#fffaf0"; }}
                      onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <td style={{ padding: "10px 16px", fontFamily: "Oswald,sans-serif", fontWeight: 700, color: "var(--brasa)" }}>#{order.code}</td>
                      <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ padding: "10px 8px" }}>{MODE_ICON[order.serviceMode] ?? "?"} {order.origin}</td>
                      <td style={{ padding: "10px 8px", color: "var(--muted)" }}>{order.tableName ?? "—"}{order.customerName ? ` · ${order.customerName}` : ""}</td>
                      <td style={{ padding: "10px 8px" }}>💳 {order.paymentMethod}</td>
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: STATUS_COLOR[order.status] + "22", color: STATUS_COLOR[order.status] }}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 800, color: order.status === "cancelled" ? "var(--muted)" : "var(--chapa-900)", textDecoration: order.status === "cancelled" ? "line-through" : "none" }}>
                        {money(order.totalCents)}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={order.code + "-detail"} style={{ background: "var(--creme)" }}>
                        <td colSpan={7} style={{ padding: "0 16px 14px 32px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", paddingTop: 8 }}>
                            <div>
                              <strong style={{ fontSize: 10, textTransform: "uppercase", color: "var(--muted)", letterSpacing: ".6px" }}>Itens do pedido</strong>
                              {items.map((item, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, borderBottom: "1px dashed var(--line)" }}>
                                  <span><b style={{ color: "var(--brasa)" }}>{item.quantity}×</b> {item.name}{item.observation ? <em style={{ color: "var(--muted)", fontSize: 10 }}> ↳ {item.observation}</em> : ""}</span>
                                  <span style={{ fontWeight: 700 }}>{money(item.unitPriceCents * item.quantity)}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8 }}>
                              {order.notes && <p style={{ margin: "0 0 8px", padding: "6px 8px", background: "white", borderRadius: 6, border: "1px dashed var(--line)", color: "var(--ink)", fontSize: 11 }}>📝 {order.notes}</p>}
                              <span style={{ display: "block" }}><b>Modo:</b> {order.serviceMode}</span>
                              <span style={{ display: "block" }}><b>Criado:</b> {new Date(order.createdAt).toLocaleString("pt-BR")}</span>
                              <span style={{ display: "block" }}><b>Status:</b> {STATUS_LABELS[order.status]}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────
function ReportsTab() {
  const [period, setPeriod] = useState<StatsPeriod>("day");
  const statsQuery = trpc.orders.stats.useQuery({ period });
  const stats = statsQuery.data;
  const periodLabel = { day: "Dia", week: "Semana", month: "Mês", year: "Ano" }[period];
  const barData = stats?.byDate.map(d => ({ ...d, revenue: d.revenue / 100 })) ?? [];

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {/* Period filter */}
      <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 700 }}>Agrupar por:</span>
        {(["day","week","month","year"] as StatsPeriod[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: "6px 14px", borderRadius: "999px", border: "1px solid var(--line)", background: period === p ? "var(--chapa-900)" : "#fffaf0", color: period === p ? "var(--cheddar)" : "var(--muted)", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
            {{ day: "Dia", week: "Semana", month: "Mês", year: "Ano" }[p]}
          </button>
        ))}
        <button onClick={() => statsQuery.refetch()} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", border: "1px solid var(--line)", background: "#fffaf0", borderRadius: "7px", padding: "6px 10px", fontSize: "11px", color: "var(--muted)", cursor: "pointer" }}>
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Revenue bar chart */}
      <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: "12px", padding: "1.25rem" }}>
        <h3 style={{ fontFamily: "Oswald,sans-serif", textTransform: "uppercase", fontSize: "18px", margin: "0 0 1rem", color: "var(--chapa-900)" }}>Vendas por {periodLabel}</h3>
        {statsQuery.isLoading ? <div className="loading-state" style={{ minHeight: 200 }}>Carregando…</div> : barData.length === 0 ? <div className="loading-state" style={{ minHeight: 200 }}>Sem dados no período</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 10, fill: "var(--muted)" }} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Receita"]} />
              <Bar dataKey="revenue" fill="var(--brasa)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top items table (stock usage) */}
      <div style={{ background: "#fffdf9", border: "1px solid var(--line)", borderRadius: "12px", padding: "1.25rem" }}>
        <h3 style={{ fontFamily: "Oswald,sans-serif", textTransform: "uppercase", fontSize: "18px", margin: "0 0 1rem", color: "var(--chapa-900)" }}>📦 Produtos mais vendidos</h3>
        {statsQuery.isLoading ? <div className="loading-state" style={{ minHeight: 120 }}>Carregando…</div> : (stats?.topItems ?? []).length === 0 ? <p style={{ color: "var(--muted)", fontSize: "12px", textAlign: "center", padding: "2rem 0" }}>Sem vendas registradas.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead><tr style={{ color: "var(--muted)", fontSize: "10px", textTransform: "uppercase", letterSpacing: ".6px" }}><th style={{ textAlign: "left", padding: "6px 0" }}>Produto</th><th style={{ textAlign: "right", padding: "6px 0" }}>Qtd vendida</th><th style={{ textAlign: "right", padding: "6px 0" }}>Receita</th></tr></thead>
            <tbody>{(stats?.topItems ?? []).map((item, i) => <tr key={i} style={{ borderTop: "1px dashed var(--line)" }}><td style={{ padding: "10px 0" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--cheddar)", color: "var(--chapa-950)", fontSize: 9, fontWeight: 900, display: "grid", placeItems: "center" }}>{i + 1}</span>{item.name}</span></td><td style={{ textAlign: "right", fontWeight: 700 }}>{item.qty}×</td><td style={{ textAlign: "right", fontWeight: 700, color: "var(--brasa)" }}>{money(item.revenue)}</td></tr>)}
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
  const ordersQuery = trpc.orders.list.useQuery(undefined, { enabled: Boolean(auth.isAuthenticated && auth.user?.role === "admin"), refetchInterval: 8000 });
  const statsQuery = trpc.orders.stats.useQuery({ period: "day" }, { enabled: Boolean(auth.isAuthenticated && auth.user?.role === "admin") });
  const statusMutation = trpc.orders.setStatus.useMutation({ onSuccess: () => ordersQuery.refetch() });
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
        if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
        window.location.reload();
      } catch (err) { window.alert("Dev login falhou: " + String(err)); }
    };
    return <section className="staff-gate"><LockKeyhole size={34} /><h1>Área da equipe</h1><p>Entre com a conta da operação para acompanhar pedidos, cozinha e comandas.</p><Button className="primary-button" onClick={() => startLogin()}>Entrar na operação</Button>{import.meta.env.DEV && <><hr style={{ width: "100%", margin: "8px 0", opacity: 0.2 }} /><span style={{ fontSize: "11px", opacity: 0.5 }}>modo desenvolvimento</span><Button className="secondary-button" onClick={devLogin}>⚙️ Entrar como Dev Admin</Button></>}<Button className="text-button" onClick={onBack}>Voltar ao cardápio</Button></section>;
  }
  if (auth.user?.role !== "admin") return <section className="staff-gate"><LockKeyhole size={34} /><h1>Acesso restrito</h1><p>Esta conta está autenticada, mas ainda não tem permissão de operação.</p><Button className="text-button" onClick={onBack}>Voltar ao cardápio</Button></section>;

  const orders = (ordersQuery.data ?? []) as unknown as StoredOrder[];

  return <section className="operations">
    {/* Header */}
    <div className="operations-head">
      <div><span className="eyebrow">painel da casa</span><h1>Área da Equipe</h1><p style={{ color: "var(--muted)", margin: "9px 0 0" }}>Pedidos, financeiro e relatórios em tempo real.</p></div>
      <div className="operations-actions"><Button className="secondary-button" onClick={onBack}>Ver cardápio</Button><Button className="dark-button" onClick={() => auth.logout()}>Sair</Button></div>
    </div>

    {/* KPI strip */}
    <div className="ops-kpis">
      <div><span>Pedidos abertos</span><strong>{orders.filter(o => !["completed","cancelled"].includes(o.status)).length}</strong></div>
      <div><span>Na chapa agora</span><strong>{orders.filter(o => o.status === "preparing").length}</strong></div>
      <div><span>Ticket médio hoje</span><strong>{orders.length ? money(Math.round(orders.reduce((s, o) => s + o.totalCents, 0) / orders.length)) : "R$ 0,00"}</strong></div>
    </div>

    {/* Tabs */}
    <div style={{ display: "flex", gap: ".5rem", marginBottom: "1.5rem", borderBottom: "2px solid var(--line)", paddingBottom: ".75rem" }}>
      {([["orders","🚨 Esteira"],["financial","💰 Financeiro"],["reports","📊 Relatórios"]] as [OpsTab,string][]).map(([t,label]) => (
        <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", borderRadius: "8px 8px 0 0", border: "none", background: tab === t ? "var(--chapa-900)" : "transparent", color: tab === t ? "var(--cheddar)" : "var(--muted)", fontSize: "12px", fontWeight: 800, cursor: "pointer", transition: "background .18s, color .18s" }}>
          {label}
        </button>
      ))}
    </div>

    {/* Tab content */}
    {tab === "orders" && (
      ordersQuery.isLoading ? <div className="loading-state">Carregando a fila da cozinha…</div> :
      <div className="order-board">
        {columns.map(col => (
          <div className="order-column" key={col.status}>
            <div className="column-head"><h2>{col.icon} {col.label}</h2><span>{orders.filter(o => o.status === col.status).length}</span></div>
            {orders.filter(o => o.status === col.status).map(order => {
              const originIcon = order.serviceMode === "customer" ? "📱" : order.serviceMode === "waiter" ? "🧑‍🍳" : "🧾";
              return <article className="order-ticket" key={order.code}
                style={{ borderLeftColor: order.serviceMode === "customer" ? "#16a34a" : order.serviceMode === "waiter" ? "#d97706" : "#2563eb" }}>
                <div className="ticket-top"><strong>#{order.code}</strong><span>{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="ticket-meta">{originIcon} {order.origin}{order.tableName ? ` · ${order.tableName}` : ""}{order.customerName ? ` · ${order.customerName}` : ""}</div>
                <div className="ticket-items">{(Array.isArray(order.items) ? order.items as Array<{ name: string; quantity: number; observation?: string }> : []).map((item, i) => <div key={i}><b>{item.quantity}×</b> {item.name}{item.observation && <small>↳ {item.observation}</small>}</div>)}</div>
                {order.notes && <div className="ticket-note">Obs.: {order.notes}</div>}
                <div className="ticket-bottom">
                  <span style={{ fontSize: "11px", color: "var(--muted)", padding: "2px 6px", background: "var(--creme)", borderRadius: "999px" }}>💳 {order.paymentMethod}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <strong>{money(order.totalCents)}</strong>
                    <button className="icon-button small" onClick={() => printOrder(order)} title="Imprimir comanda"><Printer size={15} /></button>
                    {col.status !== "ready"
                      ? <button className="advance-button" onClick={() => statusMutation.mutate({ code: order.code, status: col.status === "received" ? "preparing" : "ready" })}><ChevronRight size={15} /></button>
                      : <button className="complete-button" onClick={() => statusMutation.mutate({ code: order.code, status: "completed" })}><Check size={15} /> Entregue</button>}
                  </div>
                </div>
              </article>;
            })}
          </div>
        ))}
      </div>
    )}

    {tab === "financial" && <FinancialTab stats={statsQuery.data ? { byPayment: statsQuery.data.byPayment, totals: statsQuery.data.totals } : undefined} />}
    {tab === "reports" && <ReportsTab />}
  </section>;
}

// ─── Home ─────────────────────────────────────────────────────────────────────
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
  const visibleMenu = useMemo(() => category === "Todos" ? menu : menu.filter(i => i.category === category), [category, menu]);

  const addLine = (item: MenuItem, quantity = 1, observation = "") => setCart(lines => {
    const key = `${item.id}-${observation.trim()}`;
    const ex = lines.find(l => `${l.id}-${l.observation}` === key);
    if (ex) return lines.map(l => `${l.id}-${l.observation}` === key ? { ...l, quantity: l.quantity + quantity } : l);
    return [...lines, { ...item, quantity, observation: observation.trim() }];
  });
  const changeLine = (line: CartLine, qty: number) => setCart(lines => qty <= 0 ? lines.filter(i => !(i.id === line.id && i.observation === line.observation)) : lines.map(i => i.id === line.id && i.observation === line.observation ? { ...i, quantity: qty } : i));
  const total = cart.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  const submitOrder = () => {
    const originMap: Record<ServiceMode, string> = { customer: "Cliente via QR Code", waiter: "Garçom / Mesa", counter: "Balcão" };
    createOrder.mutate({
      origin: originMap[serviceMode],
      serviceMode,
      tableName: tableName || undefined,
      customerName: customerName || undefined,
      paymentMethod,
      notes: notes || undefined,
      items: cart.map(i => ({ productId: i.id, name: i.name, category: i.category, quantity: i.quantity, unitPriceCents: i.priceCents, observation: i.observation })),
    }, {
      onSuccess: data => { setConfirmationCode(data.order.code); setCart([]); setCheckoutOpen(false); },
      onError: err => window.alert(err.message),
    });
  };

  // Mode selector screen
  if (activeView === "mode-select") {
    return <ServiceModePicker onSelect={mode => { setServiceMode(mode); setActiveView("order"); }} onOps={() => setActiveView("ops")} />;
  }

  if (activeView === "ops") return <Operations onBack={() => setActiveView("mode-select")} />;

  if (confirmationCode) return (
    <main className="site-shell">
      <header className="site-header"><Logo /><span className="header-note">A chapa está trabalhando.</span></header>
      <Confirmation code={confirmationCode} onNewOrder={() => setConfirmationCode(null)} />
    </main>
  );

  const cfg = MODE_CONFIG[serviceMode];

  return <main className="site-shell">
    <header className="site-header">
      <Logo />
      <nav className="desktop-nav">
        <a href="#cardapio">Cardápio</a>
        <a href="#nossa-chapa">Nossa chapa</a>
        <button onClick={() => setActiveView("ops")}>Área da equipe</button>
      </nav>
      <div className="header-actions">
        <span className="header-note">{isAuthenticated && user?.role === "admin" ? `Olá, ${user.name?.split(" ")[0] ?? "equipe"}` : "Feito na hora"}</span>
        <ModeBadge mode={serviceMode} onSwitch={() => setActiveView("mode-select")} />
        <button className="header-bag" onClick={() => setCheckoutOpen(true)}><ShoppingBag size={18} /><span>{cart.reduce((s, i) => s + i.quantity, 0)}</span></button>
      </div>
    </header>

    {/* Waiter bar: shows table/customer name persistently */}
    {serviceMode === "waiter" && <WaiterBar tableName={tableName} customerName={customerName} onChange={(t, c) => { setTableName(t); setCustomerName(c); }} />}

    {/* Counter mode top bar */}
    {serviceMode === "counter" && (
      <div style={{ background: "#eff6ff", borderBottom: "2px solid #93c5fd", padding: ".5rem clamp(20px,8vw,140px)", display: "flex", alignItems: "center", gap: ".75rem" }}>
        <MonitorSmartphone size={15} style={{ color: "#2563eb" }} />
        <span style={{ fontSize: "11px", fontWeight: 800, color: "#2563eb", textTransform: "uppercase", letterSpacing: ".8px" }}>Modo Balcão — Atendimento rápido</span>
      </div>
    )}

    {/* Hero */}
    <section className="hero">
      <div className="hero-copy">
        <span className="hero-kicker"><Sparkles size={15} /> a chapa acesa</span>
        {serviceMode === "customer" && <h1>O artesanal que chega quente na sua fome.</h1>}
        {serviceMode === "waiter"   && <h1>Pedido do garçom. Mesa atendida.</h1>}
        {serviceMode === "counter"  && <h1>Balcão. Rápido e preciso.</h1>}
        <p>{serviceMode === "customer" ? "Hambúrguer, baguete, frita e shake feitos do nosso jeito — com ingrediente de verdade e a chapa trabalhando." : serviceMode === "waiter" ? "Registre o pedido da mesa abaixo. Preencha mesa e cliente na barra amarela acima para identificar a comanda." : "Atendimento ágil no balcão. Selecione os itens e confirme o pedido rapidamente."}</p>
        <div className="hero-actions">
          <a className="primary-button" href="#cardapio">Ver cardápio <ArrowRight size={18} /></a>
          {serviceMode === "customer" && <a className="hero-link" href="#nossa-chapa">Conhecer a casa <ChevronRight size={17} /></a>}
        </div>
        <div className="hero-proof">
          <span><Flame size={16} /> Feito na chapa</span>
          <span><Clock3 size={16} /> Pedido direto</span>
          <span><ChefHat size={16} /> Molho da casa</span>
          <span style={{ color: cfg.accent, fontWeight: 800 }}>{cfg.icon} {cfg.label}</span>
        </div>
      </div>
      <div className="hero-art"><div className="hero-burger">🍔</div><div className="hero-stamp">MEU<br />CHAPA<em>Burger</em></div></div>
    </section>

    {/* Category strip */}
    <section className="category-strip" id="cardapio">
      <div className="section-intro"><span className="eyebrow">escolha a sua mordida</span><h2>Cardápio da casa</h2></div>
      <div className="category-scroll">
        <button className={category === "Todos" ? "active" : ""} onClick={() => setCategory("Todos")}>🔥 Tudo</button>
        {MENU_CATEGORIES.map(cat => <button key={cat} className={category === cat ? "active" : ""} onClick={() => setCategory(cat)}>{categoryEmoji[cat]} {cat}</button>)}
      </div>
    </section>

    <section className="menu-layout">
      <div className="menu-grid">{menuQuery.isLoading ? <div className="loading-state">Acendendo a chapa…</div> : visibleMenu.map(item => <ProductCard key={item.id} item={item} onAdd={setSelectedItem} />)}</div>
      <Cart cart={cart} onChange={changeLine} onCheckout={() => setCheckoutOpen(true)} />
    </section>

    {/* Story section (hidden in counter mode for speed) */}
    {serviceMode !== "counter" && (
      <section className="story-section" id="nossa-chapa">
        <div><span className="eyebrow">como a gente faz</span><h2>Não é só montar um lanche.</h2><p>É escolher o pão, acertar o molho, selar na chapa e mandar quente para você. O Meu Chapa nasceu para servir comida com cara de casa e atitude de quem conhece a própria cozinha.</p><div className="story-points"><span><b>01</b> Ingrediente com propósito</span><span><b>02</b> Montagem caprichada</span><span><b>03</b> Chapa no ponto</span></div></div>
        <div className="story-card"><div className="story-card-mark">🍔</div><strong>Feito na chapa.<br />Montado do seu jeito.</strong><span>Meu Chapa Burger</span></div>
      </section>
    )}

    <footer className="site-footer"><Logo compact /><div><span>Pedido direto</span><span>Comanda detalhada</span><span>Feito na hora</span></div><small>© {new Date().getFullYear()} Meu Chapa Burger. Todos os direitos reservados.</small></footer>

    <ProductDialog item={selectedItem} onClose={() => setSelectedItem(null)} onAdd={addLine} />

    {/* Checkout modal */}
    {checkoutOpen && (
      <div className="modal-backdrop" onMouseDown={() => setCheckoutOpen(false)}>
        <div className="modal-card checkout-card" onMouseDown={e => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <span className="eyebrow">quase na mordida</span>
              <h2>Revisar pedido</h2>
              {/* Mode indicator in checkout */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, padding: "3px 10px", borderRadius: "999px", background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.accent, fontSize: "10px", fontWeight: 800 }}>
                {cfg.icon} {cfg.label}
              </div>
            </div>
            <button className="icon-button" onClick={() => setCheckoutOpen(false)}><X size={18} /></button>
          </div>

          {/* Cart summary */}
          <div className="checkout-summary">
            {cart.map(item => <div key={`${item.id}-${item.observation}`}><span>{item.quantity}× {item.name}{item.observation && <small>↳ {item.observation}</small>}</span><strong>{money(item.priceCents * item.quantity)}</strong></div>)}
            <div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div>
          </div>

          {/* Mode-specific fields */}
          {serviceMode === "waiter" && (
            <div className="form-grid">
              <label className="field-label">Mesa / identificação<input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="Ex.: Mesa 08" /></label>
              <label className="field-label">Nome do cliente<input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ex.: João" /></label>
            </div>
          )}
          {serviceMode === "counter" && (
            <label className="field-label">Nome / senha de retirada<input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ex.: Senha 42 / Maria" /></label>
          )}

          {/* Payment method */}
          <label className="field-label">
            💳 Forma de pagamento
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option>Na entrega / fechamento</option>
              <option>Pix</option>
              <option>Cartão Crédito</option>
              <option>Cartão Débito</option>
              <option>Dinheiro</option>
            </select>
          </label>

          <label className="field-label">Observação da comanda<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex.: chamar no balcão, separar molhos..." rows={2} /></label>

          <Button className="primary-button full" disabled={createOrder.isPending || cart.length === 0} onClick={submitOrder}>
            {createOrder.isPending ? "Enviando para a chapa…" : "Enviar pedido"} <ArrowRight size={17} />
          </Button>
          <p className="secure-note"><CircleDollarSign size={15} /> Preço confirmado no servidor e pedido registrado com código único.</p>
        </div>
      </div>
    )}
  </main>;
}

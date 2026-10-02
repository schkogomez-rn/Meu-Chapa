import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  Flame,
  Minus,
  Plus,
  QrCode,
  Receipt,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { BrandHeader } from "@/components/design-system/BrandHeader";
import { BrandFooter } from "@/components/design-system/BrandFooter";
import { StatusBadge } from "@/components/design-system/StatusBadge";
import { formatMoney } from "@/components/design-system/Formatters";
import { MENU_CATEGORIES, type MenuCategory, type MenuItem } from "../../../shared/menu";

type CartLine = MenuItem & { quantity: number; observation: string };

export default function CustomerQRPage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const [customerName, setCustomerName] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("Combos");
  const [dialogItem, setDialogItem] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemObs, setItemObs] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Validate session on load
  const sessionQuery = trpc.qrSession.validateSession.useMutation({
    onSuccess: (data) => {
      if (data.customerName) setCustomerName(data.customerName);
      try {
        localStorage.setItem("meu_chapa_qr_token", token);
      } catch {
        // ignore storage errors
      }
    },
  });

  const menuQuery = trpc.menu.list.useQuery();
  const menu = menuQuery.data ?? [];

  // Polling order tracking if order is placed
  const orderTrackQuery = trpc.orders.get.useQuery(
    { code: orderCode ?? "" },
    {
      enabled: Boolean(orderCode),
      refetchInterval: 5000,
    }
  );

  const createOrderMutation = trpc.qrSession.createCustomerOrder.useMutation({
    onSuccess: (data) => {
      setOrderCode(data.orderCode);
      setCart([]);
      setIsCartOpen(false);
      setAlertMsg({ type: "success", text: "Pedido enviado para a chapa com sucesso!" });
    },
    onError: (err) => {
      setAlertMsg({ type: "error", text: err.message });
    },
  });

  const callWaiterMutation = trpc.qrSession.callWaiter.useMutation({
    onSuccess: (data) => {
      setAlertMsg({ type: "success", text: data.message });
    },
    onError: (err) => {
      setAlertMsg({ type: "error", text: err.message });
    },
  });

  const requestBillMutation = trpc.qrSession.requestBill.useMutation({
    onSuccess: (data) => {
      setAlertMsg({ type: "success", text: data.message });
    },
    onError: (err) => {
      setAlertMsg({ type: "error", text: err.message });
    },
  });

  useEffect(() => {
    if (token) {
      sessionQuery.mutate({ token });
    }
  }, [token]);

  const cartTotal = cart.reduce((acc, item) => acc + item.priceCents * item.quantity, 0);

  function handleAddToCart(item: MenuItem, qty: number, obs: string) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id && i.observation === obs);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += qty;
        return copy;
      }
      return [...prev, { ...item, quantity: qty, observation: obs }];
    });
    setDialogItem(null);
    setItemQuantity(1);
    setItemObs("");
  }

  function handleSendOrder() {
    if (!cart.length) return;
    createOrderMutation.mutate({
      token,
      customerName: customerName.trim() || undefined,
      items: cart.map((i) => ({
        productId: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unitPriceCents: i.priceCents,
        observation: i.observation,
      })),
    });
  }

  // Loading state
  if (sessionQuery.isPending) {
    return (
      <div className="service-picker-wrapper" style={{ justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#ffd44c" }}>
          <Sparkles className="animate-spin" size={36} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", textTransform: "uppercase" }}>
            Conectando à sua mesa...
          </p>
        </div>
      </div>
    );
  }

  // Error / Invalid QR
  if (sessionQuery.isError) {
    return (
      <div className="service-picker-wrapper">
        <div className="service-picker-container" style={{ maxWidth: "460px", textAlign: "center" }}>
          <div className="environment-card customer-portal" style={{ padding: "36px 24px" }}>
            <AlertCircle size={48} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
            <h2 style={{ fontFamily: "Oswald, sans-serif", fontSize: "28px", textTransform: "uppercase", color: "#fff", margin: "0 0 10px" }}>
              QR Code Indisponível
            </h2>
            <p style={{ color: "#d6be9f", fontSize: "14px", lineHeight: 1.5, margin: "0 0 24px" }}>
              {sessionQuery.error.message || "Este QR Code é inválido ou já foi finalizado pelo atendimento."}
            </p>
            <p style={{ fontSize: "12px", color: "#a8947f", margin: "0 0 24px" }}>
              Por favor, solicite ao garçom a ativação ou leitura de um novo QR Code para a sua mesa.
            </p>
            <a
              href="/"
              className="portal-primary-btn"
              style={{ textDecoration: "none", width: "100%", justifyContent: "center" }}
            >
              <span>Ir para o Cardápio Geral</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;

  return (
    <div style={{ minHeight: "100vh", background: "#0d0604", color: "#fff8eb", display: "flex", flexDirection: "column" }}>
      {/* Header with Table info */}
      <BrandHeader
        subtitle={`Atendimento Digital • ${session?.tableName ?? "Mesa"}`}
        compact
      />

      {/* Table Banner */}
      <div
        style={{
          background: "linear-gradient(90deg, #1c0e08, #2a140a, #1c0e08)",
          borderBottom: "1px solid rgba(255, 196, 0, 0.25)",
          padding: "10px clamp(16px, 4vw, 36px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              background: "linear-gradient(135deg, #ffd44c, #f07b17)",
              color: "#120704",
              fontWeight: 900,
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "8px",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
            }}
          >
            {session?.tableName}
          </span>
          <span style={{ fontSize: "12px", color: "#d6be9f" }}>
            {customerName ? `Cliente: ${customerName}` : "Pedido vinculado à sua mesa"}
          </span>
        </div>

        {/* Quick action buttons for table */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            disabled={callWaiterMutation.isPending}
            onClick={() => callWaiterMutation.mutate({ token })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 196, 0, 0.3)",
              color: "#ffd44c",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <BellRing size={13} />
            Chamar Garçom
          </button>
          <button
            type="button"
            disabled={requestBillMutation.isPending}
            onClick={() => requestBillMutation.mutate({ token })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 196, 0, 0.3)",
              color: "#ffd44c",
              padding: "6px 12px",
              borderRadius: "8px",
              fontSize: "11px",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            <Receipt size={13} />
            Pedir Conta
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {alertMsg && (
        <div
          style={{
            margin: "12px clamp(16px, 4vw, 36px) 0",
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
          <button
            onClick={() => setAlertMsg(null)}
            style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main style={{ flex: 1, padding: "20px clamp(16px, 4vw, 36px)", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        {/* If user has active order, show real-time tracking badge */}
        {orderCode && orderTrackQuery.data && (
          <section
            style={{
              background: "linear-gradient(135deg, rgba(38, 20, 12, 0.95), rgba(22, 11, 7, 0.95))",
              border: "1px solid rgba(255, 196, 0, 0.35)",
              borderRadius: "16px",
              padding: "18px 22px",
              marginBottom: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--cheddar)", fontWeight: 800, textTransform: "uppercase" }}>
                  Status em Tempo Real
                </span>
                <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", margin: "2px 0", color: "#fff" }}>
                  Pedido #{orderCode}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#d6be9f" }}>
                  Total: <strong>{formatMoney(orderTrackQuery.data.totalCents)}</strong> • Acompanhando cozinha
                </p>
              </div>
              <StatusBadge status={orderTrackQuery.data.status} size="md" />
            </div>
          </section>
        )}

        {/* Categories Bar */}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px", scrollbarWidth: "none" }}>
          {MENU_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: "8px 16px",
                borderRadius: "999px",
                border: selectedCategory === cat ? "1px solid var(--cheddar)" : "1px solid rgba(255, 255, 255, 0.1)",
                background: selectedCategory === cat ? "linear-gradient(135deg, #ffd44c, #f07b17)" : "rgba(255, 255, 255, 0.05)",
                color: selectedCategory === cat ? "#120704" : "#d6be9f",
                fontWeight: 750,
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "18px",
          }}
        >
          {menu
            .filter((item) => item.category === selectedCategory)
            .map((item) => (
              <div
                key={item.id}
                style={{
                  background: "linear-gradient(160deg, rgba(32, 17, 10, 0.95), rgba(18, 9, 5, 0.96))",
                  border: "1px solid rgba(255, 196, 0, 0.22)",
                  borderRadius: "16px",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", color: "var(--cheddar)" }}>
                      {item.category}
                    </span>
                    {item.tags?.[0] && (
                      <span style={{ fontSize: "9px", background: "rgba(255, 196, 0, 0.15)", color: "#ffd44c", padding: "2px 6px", borderRadius: "999px" }}>
                        {item.tags[0]}
                      </span>
                    )}
                  </div>
                  <h4 style={{ fontFamily: "Oswald, sans-serif", fontSize: "19px", textTransform: "uppercase", color: "#fff", margin: "0 0 6px" }}>
                    {item.name}
                  </h4>
                  <p style={{ fontSize: "12px", color: "#a8947f", margin: 0, lineHeight: 1.45 }}>
                    {item.description}
                  </p>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                  <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "20px", color: "#ffd44c" }}>
                    {formatMoney(item.priceCents)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogItem(item);
                      setItemQuantity(1);
                      setItemObs("");
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      background: "linear-gradient(135deg, #ffc400, #f07b17)",
                      color: "#120704",
                      border: 0,
                      borderRadius: "10px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: "0 3px 0 #9c5500",
                    }}
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>
              </div>
            ))}
        </div>
      </main>

      {/* Floating Cart Button */}
      {cart.length > 0 && !isCartOpen && (
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            background: "linear-gradient(135deg, #ffc400, #f07b17)",
            color: "#120704",
            border: 0,
            borderRadius: "999px",
            padding: "14px 22px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: 800,
            fontSize: "14px",
            boxShadow: "0 8px 30px rgba(240, 123, 23, 0.5), 0 4px 0 #9c5500",
            cursor: "pointer",
            zIndex: 40,
          }}
        >
          <ShoppingBag size={20} />
          <span>Ver Comanda ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          <span style={{ background: "#120704", color: "#ffd44c", padding: "2px 8px", borderRadius: "999px", fontSize: "12px" }}>
            {formatMoney(cartTotal)}
          </span>
        </button>
      )}

      {/* Cart Modal / Drawer */}
      {isCartOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setIsCartOpen(false)}
        >
          <div
            style={{
              width: "min(420px, 100%)",
              height: "100%",
              background: "#180d09",
              borderLeft: "1px solid rgba(255, 196, 0, 0.3)",
              display: "flex",
              flexDirection: "column",
              padding: "20px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--cheddar)", fontWeight: 800, textTransform: "uppercase" }}>
                  Comanda Digital
                </span>
                <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", color: "#fff", margin: "2px 0" }}>
                  {session?.tableName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                style={{ background: "transparent", border: 0, color: "#d6be9f", cursor: "pointer" }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ margin: "14px 0" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#d6be9f", marginBottom: "4px" }}>
                Seu Nome na Comanda (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos, Ana..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255, 196, 0, 0.25)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {cart.map((line, idx) => (
                <div
                  key={`${line.id}-${idx}`}
                  style={{
                    background: "rgba(255, 255, 255, 0.04)",
                    borderRadius: "10px",
                    padding: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: "10px" }}>
                    <strong style={{ fontSize: "13px", color: "#fff", display: "block" }}>{line.name}</strong>
                    <span style={{ fontSize: "11px", color: "#ffd44c" }}>{formatMoney(line.priceCents)}</span>
                    {line.observation && (
                      <span style={{ fontSize: "10px", color: "#a8947f", display: "block" }}>
                        Obs: {line.observation}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setCart((prev) => {
                          const copy = [...prev];
                          if (copy[idx].quantity > 1) {
                            copy[idx].quantity -= 1;
                            return copy;
                          }
                          return copy.filter((_, i) => i !== idx);
                        });
                      }}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(0,0,0,0.3)",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ fontSize: "13px", fontWeight: 800, minWidth: "16px", textAlign: "center" }}>
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCart((prev) => {
                          const copy = [...prev];
                          copy[idx].quantity += 1;
                          return copy;
                        });
                      }}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(0,0,0,0.3)",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px" }}>
                <span>Total da comanda:</span>
                <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: "24px", color: "var(--cheddar)" }}>
                  {formatMoney(cartTotal)}
                </strong>
              </div>

              <button
                type="button"
                disabled={createOrderMutation.isPending || !cart.length}
                onClick={handleSendOrder}
                className="portal-primary-btn"
                style={{ width: "100%", justifyContent: "center" }}
              >
                <span>{createOrderMutation.isPending ? "Enviando à Chapa..." : "Enviar Pedido à Cozinha"}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Customization Modal */}
      {dialogItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(5px)",
            zIndex: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "18px",
          }}
          onClick={() => setDialogItem(null)}
        >
          <div
            style={{
              width: "min(460px, 100%)",
              background: "#1c0e08",
              border: "1px solid rgba(255, 196, 0, 0.35)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--cheddar)", fontWeight: 800, textTransform: "uppercase" }}>
                  Personalize seu lanche
                </span>
                <h3 style={{ fontFamily: "Oswald, sans-serif", fontSize: "22px", color: "#fff", margin: "4px 0" }}>
                  {dialogItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDialogItem(null)}
                style={{ background: "transparent", border: 0, color: "#d6be9f", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "12px", color: "#a8947f", margin: 0 }}>
              {dialogItem.description}
            </p>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 750, color: "#d6be9f", marginBottom: "6px" }}>
                Observações para a chapa (ex: sem cebola, ponto da carne)
              </label>
              <textarea
                rows={2}
                maxLength={200}
                value={itemObs}
                onChange={(e) => setItemObs(e.target.value)}
                placeholder="Ex: carne bem passada, sem maionese..."
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255, 196, 0, 0.25)",
                  borderRadius: "8px",
                  color: "#fff",
                  fontSize: "13px",
                  resize: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => Math.max(1, q - 1))}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Minus size={14} />
                </button>
                <strong style={{ fontSize: "15px" }}>{itemQuantity}</strong>
                <button
                  type="button"
                  onClick={() => setItemQuantity((q) => q + 1)}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCart(dialogItem, itemQuantity, itemObs)}
                className="portal-primary-btn"
                style={{ padding: "10px 18px", fontSize: "12px" }}
              >
                <span>Adicionar • {formatMoney(dialogItem.priceCents * itemQuantity)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <BrandFooter />
    </div>
  );
}

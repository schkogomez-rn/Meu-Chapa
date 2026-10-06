import React, { useMemo, useState } from "react";
import { Minus, PencilLine, Plus, Search, ShoppingBag, Trash2, Undo2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatMoney } from "@/components/design-system/Formatters";
import { MENU, MENU_CATEGORIES, calcTotal, type MenuCategory } from "../../../../shared/menu";

export interface EditableOrderItem {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPriceCents: number;
  observation?: string;
}

interface EditOrderModalProps {
  order: {
    code: string;
    tableName: string | null;
    origin: string;
    customerName: string | null;
    paymentMethod: string;
    status: string;
    items: unknown;
    totalCents: number;
    paidCents?: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

type DraftItem = EditableOrderItem & { key: string; originalQty: number };

const MAX_QTY = 99;

export function EditOrderModal({ order, onClose, onSuccess }: EditOrderModalProps) {
  const initialItems = useMemo<DraftItem[]>(() => {
    const raw = (Array.isArray(order.items) ? order.items : []) as EditableOrderItem[];
    return raw.map((i, idx) => ({
      ...i,
      observation: i.observation ?? "",
      key: `orig-${idx}-${i.productId}`,
      originalQty: i.quantity,
    }));
  }, [order.items]);

  const [items, setItems] = useState<DraftItem[]>(initialItems);
  const [category, setCategory] = useState<MenuCategory | "Todos">("Todos");
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = trpc.orders.updateItems.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => setErrorMsg(err.message),
  });

  const activeItems = items.filter((i) => i.quantity > 0);
  const subtotal = activeItems.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const { totalCents: newTotal } = calcTotal(subtotal, order.paymentMethod || "");
  const paid = order.paidCents || 0;
  const diff = newTotal - order.totalCents;

  const hasChanges =
    items.some((i) => i.quantity !== i.originalQty) ||
    items.length !== initialItems.length;

  const filteredMenu = MENU.filter((m) => {
    if (category !== "Todos" && m.category !== category) return false;
    if (search.trim()) return m.name.toLowerCase().includes(search.trim().toLowerCase());
    return true;
  });

  const changeQty = (key: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, quantity: Math.max(0, Math.min(MAX_QTY, i.quantity + delta)) } : i
      )
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: 0 } : i))
        // itens recém-adicionados (originalQty = 0) somem da lista ao serem removidos
        .filter((i) => !(i.key === key && i.originalQty === 0))
    );
  };

  const restoreItem = (key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: i.originalQty } : i)));
  };

  const addProduct = (productId: string) => {
    const product = MENU.find((m) => m.id === productId);
    if (!product) return;
    setItems((prev) => {
      // Se já existe uma linha nova (sem observação) desse produto, só incrementa
      const existing = prev.find((i) => i.productId === productId && !i.observation && i.quantity > 0);
      if (existing) {
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + 1) } : i
        );
      }
      return [
        ...prev,
        {
          key: `new-${Date.now()}-${productId}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          quantity: 1,
          unitPriceCents: product.priceCents,
          observation: "",
          originalQty: 0,
        },
      ];
    });
  };

  const handleSave = () => {
    setErrorMsg(null);
    if (activeItems.length === 0) {
      setErrorMsg("O pedido precisa ter ao menos 1 item. Para excluir o pedido inteiro, solicite o cancelamento ao caixa/gerência.");
      return;
    }
    if (paid > newTotal) {
      setErrorMsg("O novo total ficaria menor que o valor já pago. Solicite um estorno antes de remover itens.");
      return;
    }
    mutation.mutate({
      code: order.code,
      reason: reason.trim() || undefined,
      items: activeItems.map((i) => ({
        productId: i.productId,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        unitPriceCents: i.unitPriceCents,
        observation: i.observation ?? "",
      })),
    });
  };

  const qtyBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: "1px solid rgba(255,196,0,0.3)",
    background: "rgba(255,196,0,0.08)",
    color: "#ffd44c",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  };

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(5, 2, 1, 0.78)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, rgba(38,20,12,0.98), rgba(18,9,5,0.99))",
          border: "1px solid rgba(255,196,0,0.25)",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          color: "#fff8eb",
          overflow: "hidden",
          animation: "editOrderPop .18s ease-out",
        }}
      >
        <style>{`@keyframes editOrderPop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
          .eo-prod:hover{border-color:rgba(255,196,0,.55)!important;transform:translateY(-1px)}
          .eo-prod{transition:all .15s ease}`}</style>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,196,0,0.15)", color: "#ffd44c", display: "grid", placeItems: "center" }}>
              <PencilLine size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "Oswald, sans-serif", fontSize: 20, textTransform: "uppercase" }}>
                Editar Pedido #{order.code}
              </h2>
              <span style={{ fontSize: 12, color: "var(--cheddar, #ffc400)" }}>
                {order.tableName || order.origin} {order.customerName ? `• ${order.customerName}` : ""}
              </span>
            </div>
          </div>
          <button type="button" id="edit-order-close" onClick={onClose} style={{ background: "transparent", border: 0, color: "#d6be9f", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 0, overflowY: "auto", flex: 1 }}>
          {/* Itens do pedido */}
          <section style={{ padding: "16px 20px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, textTransform: "uppercase", color: "#a8947f", letterSpacing: 0.5 }}>
              Itens do pedido
            </h3>
            {order.status !== "pending_waiter" && (
              <div style={{ fontSize: 11, color: "#fde68a", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
                ⚠️ Este pedido já está na cozinha. Avise a chapa sobre as alterações.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((i) => {
                const removed = i.quantity === 0;
                const isNew = i.originalQty === 0;
                const changed = !isNew && i.quantity !== i.originalQty;
                return (
                  <div
                    key={i.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 10,
                      background: removed ? "rgba(239,68,68,0.08)" : isNew ? "rgba(34,197,94,0.08)" : "rgba(0,0,0,0.25)",
                      border: `1px solid ${removed ? "rgba(239,68,68,0.3)" : isNew ? "rgba(34,197,94,0.3)" : changed ? "rgba(255,196,0,0.35)" : "rgba(255,255,255,0.06)"}`,
                      opacity: removed ? 0.7 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13, textDecoration: removed ? "line-through" : "none" }}>{i.name}</strong>
                      {isNew && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: "#86efac" }}>NOVO</span>}
                      {changed && !removed && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: "#ffd44c" }}>
                          ERA {i.originalQty}x
                        </span>
                      )}
                      {removed && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: "#fca5a5" }}>REMOVIDO</span>}
                      <span style={{ display: "block", fontSize: 11, color: "#a8947f" }}>
                        {formatMoney(i.unitPriceCents)} un.
                        {i.observation ? ` • Obs: ${i.observation}` : ""}
                      </span>
                    </div>

                    {removed ? (
                      <button type="button" onClick={() => restoreItem(i.key)} style={{ ...qtyBtn, width: "auto", padding: "0 10px", gap: 4, display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700 }}>
                        <Undo2 size={13} /> Desfazer
                      </button>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button type="button" aria-label="Diminuir" onClick={() => changeQty(i.key, -1)} style={qtyBtn}>
                            <Minus size={14} />
                          </button>
                          <span style={{ minWidth: 22, textAlign: "center", fontWeight: 800, fontFamily: "Oswald, sans-serif", fontSize: 16 }}>
                            {i.quantity}
                          </span>
                          <button type="button" aria-label="Aumentar" onClick={() => changeQty(i.key, 1)} style={qtyBtn}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <span style={{ width: 72, textAlign: "right", fontSize: 12, color: "#ffd44c", fontWeight: 700 }}>
                          {formatMoney(i.unitPriceCents * i.quantity)}
                        </span>
                        <button
                          type="button"
                          aria-label="Remover item"
                          title="Remover item inteiro"
                          onClick={() => removeItem(i.key)}
                          style={{ ...qtyBtn, borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <label style={{ display: "block", marginTop: 14, fontSize: 11, color: "#a8947f", fontWeight: 700, textTransform: "uppercase" }}>
              Motivo da alteração (opcional)
              <input
                id="edit-order-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Cliente trocou a bebida"
                maxLength={240}
                style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", color: "#fff8eb", fontSize: 13, textTransform: "none" }}
              />
            </label>
          </section>

          {/* Adicionar itens */}
          <section style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 13, textTransform: "uppercase", color: "#a8947f", letterSpacing: 0.5 }}>
              Adicionar itens
            </h3>
            <div style={{ position: "relative", marginBottom: 10 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#a8947f" }} />
              <input
                id="edit-order-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.35)", color: "#fff8eb", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {(["Todos", ...MENU_CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${category === c ? "#ffc400" : "rgba(255,255,255,0.12)"}`,
                    background: category === c ? "rgba(255,196,0,0.18)" : "transparent",
                    color: category === c ? "#ffd44c" : "#d6be9f",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxHeight: 340, overflowY: "auto", paddingRight: 4 }}>
              {filteredMenu.length === 0 && (
                <span style={{ fontSize: 12, color: "#6e5a47" }}>Nenhum produto encontrado.</span>
              )}
              {filteredMenu.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="eo-prod"
                  onClick={() => addProduct(m.id)}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.3)",
                    color: "#fff8eb",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{m.name}</span>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                    <span style={{ color: "#ffd44c" }}>{formatMoney(m.priceCents)}</span>
                    <Plus size={13} style={{ color: "#86efac" }} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", background: "rgba(0,0,0,0.25)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#a8947f" }}>
              Total anterior: {formatMoney(order.totalCents)}
              {paid > 0 ? ` • Já pago: ${formatMoney(paid)}` : ""}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingBag size={16} style={{ color: "#ffd44c" }} />
              <strong style={{ fontFamily: "Oswald, sans-serif", fontSize: 22, color: "#ffd44c" }}>{formatMoney(newTotal)}</strong>
              {diff !== 0 && (
                <span style={{ fontSize: 12, fontWeight: 800, color: diff > 0 ? "#86efac" : "#fca5a5" }}>
                  {diff > 0 ? "+" : "−"}
                  {formatMoney(Math.abs(diff))}
                </span>
              )}
            </span>
          </div>

          {errorMsg && (
            <div style={{ flexBasis: "100%", order: -1, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
              {errorMsg}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "#d6be9f", fontWeight: 700, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              id="edit-order-save"
              disabled={!hasChanges || mutation.isPending}
              onClick={handleSave}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: 0,
                background: "linear-gradient(135deg, #ffc400, #f07b17)",
                color: "#120704",
                fontWeight: 800,
                cursor: !hasChanges || mutation.isPending ? "not-allowed" : "pointer",
                opacity: !hasChanges || mutation.isPending ? 0.5 : 1,
                boxShadow: "0 4px 14px rgba(240,123,23,0.35)",
              }}
            >
              {mutation.isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

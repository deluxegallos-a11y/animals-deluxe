"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Plus, Minus, Trash2, CreditCard, PackageCheck } from "lucide-react";
import { cop } from "@/lib/ai/format";
import { type CartItem, cartSubtotal, cartCount } from "@/lib/cart-service";
import { checkoutShopify } from "@/app/order-actions";
import { CodForm } from "@/components/store/cod-form";
import type { CodFormConfig } from "@/lib/db/schema";

const KEY = "ad_cart_v1";

type State = { items: CartItem[]; open: boolean };
type Action =
  | { type: "HYDRATE"; items: CartItem[] }
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; id: string }
  | { type: "QTY"; id: string; qty: number }
  | { type: "CLEAR" }
  | { type: "OPEN" }
  | { type: "CLOSE" };

const idOf = (i: { slug: string; presLabel: string }) => `${i.slug}::${i.presLabel}`;

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case "HYDRATE": return { ...state, items: a.items };
    case "ADD": {
      const id = idOf(a.item);
      const ex = state.items.find((i) => idOf(i) === id);
      const items = ex
        ? state.items.map((i) => (idOf(i) === id ? { ...i, qty: Math.min(99, i.qty + a.item.qty) } : i))
        : [...state.items, a.item];
      return { items, open: true };
    }
    case "REMOVE": return { ...state, items: state.items.filter((i) => idOf(i) !== a.id) };
    case "QTY": return { ...state, items: state.items.map((i) => (idOf(i) === a.id ? { ...i, qty: Math.max(1, Math.min(99, a.qty)) } : i)) };
    case "CLEAR": return { ...state, items: [] };
    case "OPEN": return { ...state, open: true };
    case "CLOSE": return { ...state, open: false };
    default: return state;
  }
}

type Ctx = {
  items: CartItem[]; open: boolean; count: number; subtotal: number; wa: string; codForm: CodFormConfig;
  add: (item: CartItem) => void; remove: (id: string) => void; setQty: (id: string, qty: number) => void;
  clear: () => void; openCart: () => void; closeCart: () => void;
};
const CartContext = React.createContext<Ctx | null>(null);

export function useCart(): Ctx {
  const c = React.useContext(CartContext);
  if (!c) throw new Error("useCart fuera de <CartProvider>");
  return c;
}

export function CartProvider({ children, wa, codForm = {} }: { children: React.ReactNode; wa: string; codForm?: CodFormConfig }) {
  const [state, dispatch] = React.useReducer(reducer, { items: [], open: false });

  React.useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) dispatch({ type: "HYDRATE", items: JSON.parse(raw) }); } catch { /* noop */ }
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state.items)); } catch { /* noop */ }
  }, [state.items]);

  const value: Ctx = React.useMemo(() => ({
    items: state.items, open: state.open, count: cartCount(state.items), subtotal: cartSubtotal(state.items), wa, codForm,
    add: (item) => dispatch({ type: "ADD", item }),
    remove: (id) => dispatch({ type: "REMOVE", id }),
    setQty: (id, qty) => dispatch({ type: "QTY", id, qty }),
    clear: () => dispatch({ type: "CLEAR" }),
    openCart: () => dispatch({ type: "OPEN" }),
    closeCart: () => dispatch({ type: "CLOSE" }),
  }), [state, wa, codForm]);

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}

/* Botón de carrito del nav con badge en vivo */
export function CartButton() {
  const { count, openCart } = useCart();
  return (
    <button className="ncart" onClick={openCart} aria-label={`Carrito (${count})`}>
      <ShoppingCart size={18} />
      {count > 0 ? <span className="cbadge num">{count}</span> : null}
    </button>
  );
}

function CartDrawer() {
  const { items, open, subtotal, count, codForm, remove, setQty, clear, closeCart } = useCart();
  const [codOpen, setCodOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Esc + scroll lock + foco
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeCart(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 60);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; clearTimeout(t); };
  }, [open, closeCart]);

  const id = (i: CartItem) => `${i.slug}::${i.presLabel}`;
  const [paying, setPaying] = React.useState(false);
  const [payErr, setPayErr] = React.useState("");
  async function payShopify() {
    setPaying(true); setPayErr("");
    const r = await checkoutShopify(items.map((i) => ({ slug: i.slug, presentacion: i.presLabel, cantidad: i.qty })));
    if (r.ok) { window.location.href = r.url; return; }
    setPaying(false); setPayErr(r.error);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="cart-root" role="dialog" aria-modal="true" aria-label="Carrito de compras"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="cart-overlay" onClick={closeCart} />
          <motion.aside ref={panelRef} className="cart-panel"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <div className="cart-head">
              <h3><ShoppingCart size={18} /> Tu carrito {count > 0 ? <span className="ct">{count}</span> : null}</h3>
              <button className="cart-x" data-autofocus onClick={closeCart} aria-label="Cerrar"><X size={18} /></button>
            </div>

            {items.length === 0 ? (
              <div className="cart-empty">
                <div className="ic"><ShoppingCart size={30} /></div>
                <h4>Tu carrito está vacío</h4>
                <p>Agrega productos para tu campeón 🐓</p>
                <Link href="/#lineas" className="cart-go" onClick={closeCart}>Ver catálogo</Link>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {items.map((i) => (
                    <div className="cart-line" key={id(i)}>
                      <div className="cl-img">{i.imageUrl ? <img src={i.imageUrl} alt="" /> : <ShoppingCart size={20} />}</div>
                      <div className="cl-info">
                        <b>{i.name}</b>
                        {i.presLabel ? <span className="cl-pres">{i.presLabel}</span> : null}
                        <span className="cl-price">{cop(i.priceCOP)}</span>
                        <div className="cl-row">
                          <div className="stepper">
                            <button onClick={() => setQty(id(i), i.qty - 1)} aria-label="Quitar uno"><Minus size={14} /></button>
                            <span>{i.qty}</span>
                            <button onClick={() => setQty(id(i), i.qty + 1)} aria-label="Agregar uno"><Plus size={14} /></button>
                          </div>
                          <button className="cl-del" onClick={() => remove(id(i))} aria-label="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </div>
                      <div className="cl-sub">{cop(i.priceCOP * i.qty)}</div>
                    </div>
                  ))}
                </div>

                <div className="cart-foot">
                  <div className="cart-sum">
                    <span>Subtotal ({count} {count === 1 ? "ítem" : "ítems"})</span>
                    <b>{cop(subtotal)}</b>
                  </div>
                  <button className="cart-pay" onClick={payShopify} disabled={paying}>
                    {paying ? "Abriendo pago…" : <><CreditCard size={18} /> Pagar online — {cop(subtotal)}</>}
                  </button>
                  {payErr ? <div className="cart-payerr">{payErr}</div> : null}
                  <button className="cart-cod" onClick={() => setCodOpen(true)}>
                    <PackageCheck size={18} /> Pedir contraentrega
                  </button>
                  <p className="cart-note">🔒 Pago online seguro · o pagás al recibir 🏠</p>
                  <button className="cart-clear" onClick={clear}>Vaciar carrito</button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      ) : null}

      {codOpen && items.length ? (
        <CodForm
          items={items.map((i) => ({ slug: i.slug, name: i.name, presLabel: i.presLabel, qty: i.qty, priceCOP: i.priceCOP, imageUrl: i.imageUrl || "" }))}
          upsellCfg={codForm}
          onClose={() => setCodOpen(false)}
        />
      ) : null}
    </AnimatePresence>
  );
}

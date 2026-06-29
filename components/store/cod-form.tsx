"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { cop } from "@/lib/ai/format";
import { crearPedidoWeb } from "@/app/order-actions";
import type { CodFormConfig } from "@/lib/db/schema";
// Estilos del modal empaquetados con el componente, para que el formulario se
// pueda reutilizar fuera del storefront (landings) sin cargar store-theme.css.
import "./cod-form.css";

export type CodItem = { slug: string; name: string; presLabel: string; qty: number; priceCOP: number; imageUrl: string };

const DEPARTAMENTOS = ["Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada"];

const idOf = (i: CodItem) => `${i.slug}::${i.presLabel}`;

/* Formulario contraentrega: acepta varios productos y cantidades editables. */
export function CodForm({ items: initial, upsellCfg, onClose }: { items: CodItem[]; upsellCfg?: CodFormConfig; onClose: () => void }) {
  const [items, setItems] = React.useState<CodItem[]>(initial);
  const [f, setF] = React.useState({ nombre: "", telefono: "", departamento: "", ciudad: "", direccion: "" });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [done, setDone] = React.useState<{ ref: string } | null>(null);
  const [addUpsell, setAddUpsell] = React.useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const setQty = (id: string, q: number) => setItems((arr) => arr.map((it) => (idOf(it) === id ? { ...it, qty: Math.max(1, Math.min(99, q)) } : it)));
  const remove = (id: string) => setItems((arr) => (arr.length > 1 ? arr.filter((it) => idOf(it) !== id) : arr));

  const upsellOn = !!(upsellCfg?.upsellEnabled && upsellCfg.upsellTitulo);
  const upsellPrice = upsellCfg?.upsellPrecioCop || 0;
  const subtotal = items.reduce((s, it) => s + it.priceCOP * it.qty, 0);
  const grandTotal = subtotal + (addUpsell ? upsellPrice : 0);
  const units = items.reduce((s, it) => s + it.qty, 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setBusy(true); setErr("");
    const r = await crearPedidoWeb({
      ...f, upsell: addUpsell,
      items: items.map((it) => ({ slug: it.slug, presentacion: it.presLabel, cantidad: it.qty })),
    });
    setBusy(false);
    if (r.ok) setDone({ ref: r.ref });
    else setErr(r.error);
  }

  return (
    <div className="cod-back" role="dialog" aria-modal="true" aria-label="Pedido contraentrega" onClick={onClose}>
      <motion.div className="cod-modal" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}>
        <button className="cod-x" onClick={onClose} aria-label="Cerrar">✕</button>
        {done ? (
          <div className="cod-done">
            <div className="ic">✅</div>
            <h3>¡Pedido recibido!</h3>
            <p>Tu ref es <b>{done.ref}</b>. Un asesor te contacta para confirmar el envío. Pagás cuando recibís 🐓</p>
            <button className="cod-submit" onClick={onClose}>Listo</button>
          </div>
        ) : (
          <>
            <h3>Pedir contraentrega</h3>
            <div className="cod-items">
              {items.map((it) => (
                <div className="cod-item" key={idOf(it)}>
                  <div className="cod-item-img">{it.imageUrl ? <img src={it.imageUrl} alt="" /> : <span>🐓</span>}</div>
                  <div className="cod-item-info">
                    <b>{it.name}</b>
                    {it.presLabel ? <span className="cod-item-pres">{it.presLabel}</span> : null}
                    <span className="cod-item-price">{cop(it.priceCOP)} c/u</span>
                  </div>
                  <div className="cod-item-right">
                    <div className="cod-step">
                      <button type="button" onClick={() => setQty(idOf(it), it.qty - 1)} aria-label="Quitar uno"><Minus size={14} /></button>
                      <span>{it.qty}</span>
                      <button type="button" onClick={() => setQty(idOf(it), it.qty + 1)} aria-label="Agregar uno"><Plus size={14} /></button>
                    </div>
                    {items.length > 1 ? <button type="button" className="cod-item-del" onClick={() => remove(idOf(it))} aria-label="Quitar producto"><Trash2 size={14} /></button> : null}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={submit}>
              <input required placeholder="Nombre completo" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} />
              <input required placeholder="WhatsApp / teléfono" inputMode="tel" value={f.telefono} onChange={(e) => set("telefono", e.target.value)} />
              <select required className="cod-sel" value={f.departamento} onChange={(e) => set("departamento", e.target.value)}>
                <option value="" disabled>Departamento</option>
                {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input required placeholder="Ciudad o pueblo" value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} />
              <input required placeholder="Dirección (barrio, calle y número)" value={f.direccion} onChange={(e) => set("direccion", e.target.value)} />
              {upsellOn ? (
                <label className={`cod-upsell ${addUpsell ? "on" : ""}`}>
                  <input type="checkbox" checked={addUpsell} onChange={(e) => setAddUpsell(e.target.checked)} />
                  <span className="cu-check" aria-hidden>{addUpsell ? "✓" : ""}</span>
                  <div className="cu-body">
                    <b>➕ {upsellCfg!.upsellTitulo}</b>
                    {upsellCfg!.upsellDesc ? <span>{upsellCfg!.upsellDesc}</span> : null}
                  </div>
                  {upsellPrice ? <span className="cu-price">+{cop(upsellPrice)}</span> : null}
                </label>
              ) : null}
              {err ? <div className="cod-err">{err}</div> : null}
              <button className="cod-submit" type="submit" disabled={busy}>
                {busy ? "Enviando…" : <><ShoppingCart size={18} /> Confirmar — {units} {units === 1 ? "unidad" : "unidades"} · {cop(grandTotal)}</>}
              </button>
              <p className="cod-note">💵 Pago contraentrega · pagás cuando recibís. Sin anticipos.</p>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

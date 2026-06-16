"use client";

import * as React from "react";
import { PageHead, Card } from "@/components/ui";
import { ImageUpload, SubmitButton } from "@/components/forms";
import { saveProduct, deleteProduct, toggleProduct, syncProductNow, retryShopifySync } from "../actions";
import { cop, flag } from "@/lib/ai/format";
import type { Presentacion, Ingrediente, FaqItem } from "@/lib/db/schema";

type P = {
  id: string; slug: string; name: string; categorySlug: string; categoryName: string; categoryColor: string;
  audience: string; origin: string; priceCOP: number; presentations: Presentacion[]; imageUrl: string;
  badges: string[]; tagline: string; shortDesc: string; benefits: string[]; ingredients: Ingrediente[];
  usage: string; pitch: string; faq: FaqItem[]; disclaimer: string; stock: number; activo: boolean;
  shopifyProductId: string; shopifySync: "synced" | "pending" | "error"; shopifySyncError: string;
};

function SyncBadge({ p, shopifyOn }: { p: P; shopifyOn: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const sync = async () => { setBusy(true); await syncProductNow(p.id); setBusy(false); };
  const label = !shopifyOn
    ? { txt: "Shopify off", cls: "starter", title: "Configura Shopify en /configuracion" }
    : p.shopifySync === "synced"
      ? { txt: "✓ Shopify", cls: "pro", title: `Sincronizado · ${p.shopifyProductId}` }
      : p.shopifySync === "error"
        ? { txt: "✗ error", cls: "starter", title: p.shopifySyncError || "Error de sincronía" }
        : { txt: "⏳ pendiente", cls: "starter", title: "Pendiente de sincronizar" };
  return (
    <span className="flex aic gap10" style={{ fontSize: 11 }}>
      <span className={`badge-plan ${label.cls}`} title={label.title}>{busy ? "…" : label.txt}</span>
      {shopifyOn && p.shopifySync !== "synced" ? (
        <button className="icon-act" title="Sincronizar con Shopify" disabled={busy} onClick={sync}>🔄</button>
      ) : null}
    </span>
  );
}

const presToText = (p: Presentacion[]) => p.map((x) => `${x.label} | ${x.priceCOP}`).join("\n");
const ingToText = (p: Ingrediente[]) => p.map((x) => `${x.name} | ${x.detail}`).join("\n");
const faqToText = (p: FaqItem[]) => p.map((x) => `${x.q} | ${x.a}`).join("\n");

export function ProductsUI({ productos, categorias, shopifyOn }: { productos: P[]; categorias: { slug: string; name: string }[]; shopifyOn: boolean }) {
  const [editing, setEditing] = React.useState<P | null>(null);
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("");
  const [retrying, setRetrying] = React.useState(false);
  const [retryMsg, setRetryMsg] = React.useState("");
  const pendientes = productos.filter((p) => p.shopifySync !== "synced").length;

  async function onRetry() {
    setRetrying(true); setRetryMsg("");
    const r = await retryShopifySync();
    setRetrying(false);
    setRetryMsg(`Sincronizados ${r.ok}/${r.procesados}${r.fallidos ? ` · ${r.fallidos} con error` : ""}.`);
  }

  const filtered = productos.filter((p) =>
    (!cat || p.categorySlug === cat) &&
    (!q || (p.name + " " + p.audience + " " + p.categoryName).toLowerCase().includes(q.toLowerCase())),
  );

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(p: P) { setEditing(p); setOpen(true); }

  return (
    <>
      <PageHead
        title="Productos"
        subtitle={`${productos.length} productos · ${shopifyOn ? `${pendientes} sin sincronizar` : "Shopify no configurado"}`}
        right={
          <div className="flex aic gap10">
            {shopifyOn && pendientes > 0 ? (
              <button className="btn soft" disabled={retrying} onClick={onRetry}>
                {retrying ? "Sincronizando…" : `🔄 Sincronizar Shopify (${pendientes})`}
              </button>
            ) : null}
            <button className="btn auto" onClick={openNew}>+ Nuevo producto</button>
          </div>
        }
      />
      {retryMsg ? <div className="form-msg ok" style={{ marginBottom: 16 }}>{retryMsg}</div> : null}

      <Card style={{ marginBottom: 16 }}>
        <div className="flex aic gap10" style={{ flexWrap: "wrap" }}>
          <input className="cobro-monto" style={{ fontSize: 14, fontWeight: 600, maxWidth: 260 }}
            placeholder="🔍 Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field" style={{ maxWidth: 220, marginBottom: 0 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <span className="t-mut" style={{ marginLeft: "auto", fontSize: 13 }}>{filtered.length} mostrados</span>
        </div>
      </Card>

      <div className="cardgrid">
        {filtered.map((p) => (
          <div key={p.id} className={`treat ${p.activo ? "" : "treat-off"}`}>
            <div className="treat-top">
              <div className="ic" style={{ background: p.categoryColor + "22", color: p.categoryColor }}>{flag(p.origin)}</div>
              <div className="treat-acts">
                <button className="icon-act" title="Editar" onClick={() => openEdit(p)}>✏️</button>
                <button className="icon-act" title={p.activo ? "Desactivar" : "Activar"}
                  onClick={() => toggleProduct(p.id, !p.activo)}>{p.activo ? "🟢" : "⚪"}</button>
                <button className="icon-act danger" title="Eliminar"
                  onClick={() => { if (confirm(`¿Eliminar ${p.name}?`)) deleteProduct(p.id); }}>🗑️</button>
              </div>
            </div>
            <h4>{p.name} {p.activo ? "" : <span className="off-tag">· inactivo</span>}</h4>
            <div className="desc">{p.tagline || p.shortDesc}</div>
            <div className="pr">{cop(p.priceCOP)} <small>· {p.categoryName}</small></div>
            <div style={{ marginTop: 8 }}><SyncBadge p={p} shopifyOn={shopifyOn} /></div>
          </div>
        ))}
      </div>
      {filtered.length === 0 ? <div className="empty"><div className="ico">📦</div><h4>Sin resultados</h4></div> : null}

      {open ? (
        <ProductModal
          editing={editing}
          categorias={categorias}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ProductModal({ editing, categorias, onClose }: { editing: P | null; categorias: { slug: string; name: string }[]; onClose: () => void }) {
  const [name, setName] = React.useState(editing?.name || "");
  const [price, setPrice] = React.useState(String(editing?.priceCOP || ""));
  const [tagline, setTagline] = React.useState(editing?.tagline || "");
  const [origin, setOrigin] = React.useState(editing?.origin || "co");
  const [categorySlug, setCategorySlug] = React.useState(editing?.categorySlug || (categorias[0]?.slug || ""));
  const [imageUrl, setImageUrl] = React.useState(editing?.imageUrl || "");
  const [msg, setMsg] = React.useState("");

  async function onSubmit(formData: FormData) {
    formData.set("imageUrl", imageUrl);
    const res = await saveProduct(formData);
    if (res?.ok) onClose();
    else setMsg(res?.error || "No se pudo guardar.");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{editing ? "Editar producto" : "Nuevo producto"}</h3>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {msg ? <div className="form-msg err">{msg}</div> : null}
          <div className="twocol">
            <form action={onSubmit}>
              <input type="hidden" name="id" defaultValue={editing?.id || ""} />
              <div className="field">
                <label>Nombre <span className="req">*</span></label>
                <input name="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Slug</label>
                  <input name="slug" defaultValue={editing?.slug || ""} placeholder="auto desde el nombre" />
                </div>
                <div className="field">
                  <label>Precio (COP) <span className="req">*</span></label>
                  <input name="priceCop" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="70000" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Categoría</label>
                  <select name="categorySlug" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
                    {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Origen</label>
                  <select name="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                    <option value="us">🇺🇸 USA</option><option value="co">🇨🇴 Colombia</option>
                    <option value="br">🇧🇷 Brasil</option><option value="mx">🇲🇽 México</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Audiencia (para qué animal)</label>
                <input name="audience" defaultValue={editing?.audience || ""} placeholder="Gallos de combate y exhibición" />
              </div>
              <div className="field">
                <label>Tagline (gancho corto)</label>
                <input name="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
              </div>
              <div className="field">
                <label>Descripción corta</label>
                <textarea name="shortDesc" rows={2} defaultValue={editing?.shortDesc || ""} />
              </div>
              <div className="field">
                <label>Presentaciones (una por línea: <code>label | precio</code>) <span className="req">*</span></label>
                <textarea name="presentations" rows={2} defaultValue={editing ? presToText(editing.presentations) : "Unidad | "} placeholder={"30 ml · ~40 dosis | 70000"} />
              </div>
              <div className="field">
                <label>Beneficios (uno por línea, mín. 3) <span className="req">*</span></label>
                <textarea name="benefits" rows={3} defaultValue={editing ? editing.benefits.join("\n") : ""} />
              </div>
              <div className="field">
                <label>Modo de uso <span className="req">*</span></label>
                <textarea name="usage" rows={2} defaultValue={editing?.usage || ""} />
              </div>
              <div className="field">
                <label>Pitch de venta (lo lee el bot)</label>
                <textarea name="pitch" rows={3} defaultValue={editing?.pitch || ""} />
              </div>
              <div className="field">
                <label>Badges (separados por coma)</label>
                <input name="badges" defaultValue={editing ? editing.badges.join(", ") : ""} placeholder="Original, Best Choice" />
              </div>
              <div className="field">
                <label>Ingredientes (<code>nombre | detalle</code> por línea)</label>
                <textarea name="ingredients" rows={2} defaultValue={editing ? ingToText(editing.ingredients) : ""} />
              </div>
              <div className="field">
                <label>FAQ (<code>pregunta | respuesta</code> por línea)</label>
                <textarea name="faq" rows={2} defaultValue={editing ? faqToText(editing.faq) : ""} />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Stock</label>
                  <input name="stock" type="number" defaultValue={editing?.stock ?? 999} />
                </div>
                <div className="field">
                  <label>Disclaimer</label>
                  <input name="disclaimer" defaultValue={editing?.disclaimer || ""} />
                </div>
              </div>
              <ImageUpload name="imageUrl" label="Imagen del producto" defaultUrl={imageUrl} folder="products" hint="JPG/PNG/WebP, máx 5MB" />
              <label className="switch-row">
                <span className="switch-label">Activo (visible en tienda y bot)</span>
                <span className="switch">
                  <input type="checkbox" name="activo" defaultChecked={editing ? editing.activo : true} />
                  <span className="switch-track"><span className="switch-knob" /></span>
                </span>
              </label>
              <div className="modal-actions">
                <button type="button" className="btn soft" onClick={onClose}>Cancelar</button>
                <SubmitButton>{editing ? "Guardar cambios" : "Crear producto"}</SubmitButton>
              </div>
            </form>

            {/* ---- Vista previa en vivo ---- */}
            <div>
              <div className="note" style={{ marginTop: 0 }}>Vista previa en vivo</div>
              <div className="pcard" style={{ maxWidth: 260, margin: "0 auto" }}>
                <div className="ph">
                  {imageUrl ? <img src={imageUrl} alt="preview" /> : <span>🐓</span>}
                  <span className="flag">{flag(origin)}</span>
                </div>
                <div className="body">
                  <span className="cat">{categorias.find((c) => c.slug === categorySlug)?.name || "Categoría"}</span>
                  <h3>{name || "Nombre del producto"}</h3>
                  <span className="tag">{tagline || "Tagline de venta…"}</span>
                  <div className="foot">
                    <span className="price">{cop(parseInt(price.replace(/\D/g, ""), 10) || 0)}</span>
                    <span className="go">Ver →</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

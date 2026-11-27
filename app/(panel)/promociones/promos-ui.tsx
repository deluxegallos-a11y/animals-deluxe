"use client";

import * as React from "react";
import { PageHead, Card } from "@/components/ui";
import { ImageUpload, SubmitButton } from "@/components/forms";
import { savePromotion, deletePromotion } from "../actions";
import { cop } from "@/lib/ai/format";

type Promo = {
  id: string; titulo: string; descripcion: string; precioPromoCop: number; precioAntesCop: number;
  imagenUrl: string; activa: boolean; orden: number; productId: string;
};

export function PromosUI({ promos, productos }: { promos: Promo[]; productos: { slug: string; name: string }[] }) {
  const [editing, setEditing] = React.useState<Promo | null>(null);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <PageHead title="Promociones" subtitle={`${promos.length} promos`} right={<button className="btn auto" onClick={() => { setEditing(null); setOpen(true); }}>+ Nueva promo</button>} />

      <div className="cardgrid">
        {promos.map((p) => (
          <Card key={p.id}>
            {p.imagenUrl ? <img src={p.imagenUrl} alt={p.titulo} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 12, marginBottom: 10 }} /> : null}
            <div className="flex aic" style={{ justifyContent: "space-between" }}>
              <b>{p.titulo}</b>
              <span className={p.activa ? "dot-on" : "dot-off"} />
            </div>
            <div className="t-mut" style={{ fontSize: 12.5, margin: "4px 0 8px" }}>{p.descripcion}</div>
            <div className="pr" style={{ fontWeight: 800 }}>
              {p.precioPromoCop ? cop(p.precioPromoCop) : ""}{" "}
              {p.precioAntesCop ? <small style={{ textDecoration: "line-through", color: "var(--muted)" }}>{cop(p.precioAntesCop)}</small> : null}
            </div>
            <div className="flex gap8" style={{ marginTop: 10 }}>
              <button className="icon-act" onClick={() => { setEditing(p); setOpen(true); }}>✏️ Editar</button>
              <button className="icon-act danger" onClick={() => { if (confirm("¿Eliminar promo?")) deletePromotion(p.id); }}>🗑️</button>
            </div>
          </Card>
        ))}
      </div>
      {promos.length === 0 ? <div className="empty"><div className="ico">🏷️</div><h4>Sin promociones</h4></div> : null}

      {open ? <PromoModal editing={editing} productos={productos} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PromoModal({ editing, productos, onClose }: { editing: Promo | null; productos: { slug: string; name: string }[]; onClose: () => void }) {
  const [imagenUrl, setImagenUrl] = React.useState(editing?.imagenUrl || "");
  const [msg, setMsg] = React.useState("");

  async function onSubmit(formData: FormData) {
    formData.set("imagenUrl", imagenUrl);
    const res = await savePromotion(formData);
    if (res?.ok) onClose(); else setMsg(res?.error || "No se pudo guardar.");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{editing ? "Editar promo" : "Nueva promo"}</h3><button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {msg ? <div className="form-msg err">{msg}</div> : null}
          <form action={onSubmit}>
            <input type="hidden" name="id" defaultValue={editing?.id || ""} />
            <div className="field"><label>Título <span className="req">*</span></label><input name="titulo" required defaultValue={editing?.titulo || ""} /></div>
            <div className="field"><label>Descripción</label><textarea name="descripcion" rows={2} defaultValue={editing?.descripcion || ""} /></div>
            <div className="field">
              <label>Producto vinculado</label>
              <select name="productSlug" defaultValue="">
                <option value="">— Ninguno —</option>
                {productos.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
            </div>
            <div className="field-row">
              <div className="field"><label>Precio promo (COP)</label><input name="precioPromoCop" defaultValue={editing?.precioPromoCop || ""} /></div>
              <div className="field"><label>Precio antes (COP)</label><input name="precioAntesCop" defaultValue={editing?.precioAntesCop || ""} /></div>
            </div>
            <ImageUpload name="imagenUrl" label="Imagen de la promo" defaultUrl={imagenUrl} folder="promos" />
            <div className="field-row">
              <div className="field"><label>Orden</label><input name="orden" type="number" defaultValue={editing?.orden ?? 0} /></div>
              <label className="switch-row" style={{ alignSelf: "end" }}>
                <span className="switch-label">Activa</span>
                <span className="switch"><input type="checkbox" name="activa" defaultChecked={editing ? editing.activa : true} /><span className="switch-track"><span className="switch-knob" /></span></span>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn soft" onClick={onClose}>Cancelar</button>
              <SubmitButton>{editing ? "Guardar" : "Crear"}</SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

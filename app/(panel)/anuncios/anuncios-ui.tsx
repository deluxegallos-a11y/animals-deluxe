"use client";

import * as React from "react";
import { PageHead, Card, CardHead } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { saveAdMap, deleteAdMap } from "../actions";
import type { AdMapGroup } from "@/lib/queries";

export function AnunciosUI({ mapeos, productos }: { mapeos: AdMapGroup[]; productos: { slug: string; name: string }[] }) {
  const [edit, setEdit] = React.useState<AdMapGroup | null>(null);
  const [msg, setMsg] = React.useState("");

  async function onSubmit(formData: FormData) {
    setMsg("");
    const res = await saveAdMap(formData);
    if (res?.ok) { setEdit(null); (document.getElementById("ad-form") as HTMLFormElement)?.reset(); }
    else setMsg(res?.error || "No se pudo guardar.");
  }

  const selectedSlugs = new Set((edit?.productos || []).map((p) => p.slug));

  return (
    <>
      <PageHead title="Anuncios" subtitle="Conecta cada ad_id de Meta con su(s) producto(s). El bot lo resuelve por el referral del anuncio; si no está, cae al flujo por nombre." />
      <div className="cfg-grid">
        <Card>
          <CardHead icon="📣" title={`Anuncios mapeados (${mapeos.length})`} />
          {mapeos.length ? mapeos.map((m) => (
            <div className="list-row" key={m.adId}>
              <span className={m.activo ? "dot-on" : "dot-off"} />
              <div className="meta">
                <b>{m.nombreAnuncio || m.adId}</b>
                <span>ad_id: {m.adId} · → {m.productos.map((p) => p.name).join(" + ")}</span>
              </div>
              <div className="act">
                <button className="icon-act" onClick={() => setEdit(m)}>✏️</button>
                <button className="icon-act danger" onClick={() => { if (confirm("¿Eliminar este anuncio del mapa?")) deleteAdMap(m.adId); }}>🗑️</button>
              </div>
            </div>
          )) : <div className="empty"><div className="ico">📣</div><h4>Sin anuncios mapeados</h4><p>Pega un ad_id de Meta y elige a qué producto(s) lleva.</p></div>}
        </Card>

        <Card>
          <CardHead icon="➕" title={edit ? "Editar anuncio" : "Nuevo anuncio"} />
          {msg ? <div className="form-msg err">{msg}</div> : null}
          <form action={onSubmit} id="ad-form">
            <div className="field">
              <label>ad_id de Meta <span className="req">*</span></label>
              <input name="adId" required placeholder="Ej. 120253535808910012" defaultValue={edit?.adId || ""} readOnly={!!edit} key={edit?.adId || "new-adid"} />
            </div>
            <div className="field">
              <label>Producto(s) <span className="req">*</span> <span className="field-hint">(Ctrl/Cmd para elegir varios)</span></label>
              <select name="productSlug" multiple size={8} required key={edit?.adId || "new-slugs"} defaultValue={[...selectedSlugs]} style={{ height: "auto" }}>
                {productos.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Nombre del anuncio (opcional)</label>
              <input name="nombreAnuncio" placeholder="Ej. Combo Equipo de Campeones junio" defaultValue={edit?.nombreAnuncio || ""} key={edit?.adId || "new-nom"} />
            </div>
            <label className="switch-row">
              <span className="switch-label">Activo</span>
              <span className="switch"><input type="checkbox" name="activo" defaultChecked={edit ? edit.activo : true} key={edit?.adId || "new-act"} /><span className="switch-track"><span className="switch-knob" /></span></span>
            </label>
            <div className="modal-actions">
              {edit ? <button type="button" className="btn soft" onClick={() => setEdit(null)}>Cancelar</button> : null}
              <SubmitButton>{edit ? "Guardar" : "Conectar anuncio"}</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

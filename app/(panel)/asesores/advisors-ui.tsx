"use client";

import * as React from "react";
import { PageHead, Card, CardHead } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { saveAdvisor, deleteAdvisor } from "../actions";

type A = { id: string; nombre: string; whatsapp: string; activo: boolean; pedidos: number };

export function AdvisorsUI({ asesores }: { asesores: A[] }) {
  const [edit, setEdit] = React.useState<A | null>(null);
  const [msg, setMsg] = React.useState("");

  async function onSubmit(formData: FormData) {
    const res = await saveAdvisor(formData);
    if (res?.ok) { setEdit(null); (document.getElementById("adv-form") as HTMLFormElement)?.reset(); }
    else setMsg(res?.error || "No se pudo guardar.");
  }

  return (
    <>
      <PageHead title="Asesores" subtitle="Reparten los pedidos por round-robin" />
      <div className="cfg-grid">
        <Card>
          <CardHead icon="🧑‍💼" title="Equipo de ventas" />
          {asesores.length ? asesores.map((a) => (
            <div className="list-row" key={a.id}>
              <span className={a.activo ? "dot-on" : "dot-off"} />
              <div className="meta"><b>{a.nombre}</b><span>{a.whatsapp || "sin WhatsApp"} · {a.pedidos} pedidos</span></div>
              <div className="act">
                <button className="icon-act" onClick={() => setEdit(a)}>✏️</button>
                <button className="icon-act danger" onClick={() => { if (confirm("¿Eliminar asesor?")) deleteAdvisor(a.id); }}>🗑️</button>
              </div>
            </div>
          )) : <div className="empty"><div className="ico">🧑‍💼</div><h4>Sin asesores</h4><p>Agrega al menos uno para asignar pedidos.</p></div>}
        </Card>

        <Card>
          <CardHead icon="➕" title={edit ? "Editar asesor" : "Nuevo asesor"} />
          {msg ? <div className="form-msg err">{msg}</div> : null}
          <form action={onSubmit} id="adv-form">
            <input type="hidden" name="id" value={edit?.id || ""} readOnly />
            <div className="field"><label>Nombre <span className="req">*</span></label><input name="nombre" required defaultValue={edit?.nombre || ""} key={edit?.id || "new-nombre"} /></div>
            <div className="field"><label>WhatsApp</label><input name="whatsapp" placeholder="573001234567" defaultValue={edit?.whatsapp || ""} key={edit?.id || "new-wa"} /></div>
            <label className="switch-row">
              <span className="switch-label">Activo</span>
              <span className="switch"><input type="checkbox" name="activo" defaultChecked={edit ? edit.activo : true} key={edit?.id || "new-act"} /><span className="switch-track"><span className="switch-knob" /></span></span>
            </label>
            <div className="modal-actions">
              {edit ? <button type="button" className="btn soft" onClick={() => setEdit(null)}>Cancelar</button> : null}
              <SubmitButton>{edit ? "Guardar" : "Agregar asesor"}</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}

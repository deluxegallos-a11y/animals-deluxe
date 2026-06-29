"use client";

import * as React from "react";
import { Star, Trash2, Eye, EyeOff } from "lucide-react";
import { deleteReview, toggleReview } from "@/app/(panel)/actions";
import type { Review } from "@/lib/reviews";

export function ResenasUI({ initial }: { initial: (Review & { estado?: string })[] }) {
  const [list, setList] = React.useState(initial);
  const [busy, setBusy] = React.useState<string>("");

  async function onDelete(id: string) {
    if (!confirm("¿Borrar esta reseña? No se puede deshacer.")) return;
    setBusy(id);
    await deleteReview(id);
    setList((l) => l.filter((r) => r.id !== id));
    setBusy("");
  }
  async function onToggle(r: Review & { estado?: string }) {
    const next = r.estado === "oculto" ? "aprobado" : "oculto";
    setBusy(r.id);
    await toggleReview(r.id, next);
    setList((l) => l.map((x) => (x.id === r.id ? { ...x, estado: next } : x)));
    setBusy("");
  }

  if (!list.length) {
    return <div className="empty"><div className="ico">⭐</div><h4>Sin reseñas aún</h4><p>Cuando un cliente publique una reseña en la tienda, aparecerá aquí para moderar.</p></div>;
  }

  return (
    <table>
      <thead><tr><th>Cliente</th><th>Producto</th><th>Estrellas</th><th>Reseña</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.id} style={r.estado === "oculto" ? { opacity: 0.5 } : undefined}>
            <td><b>{r.nombre}</b>{r.ciudad ? <div className="t-mut">{r.ciudad}</div> : null}</td>
            <td className="t-mut">{r.slug}</td>
            <td style={{ color: "#E8A800", whiteSpace: "nowrap" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} fill={i < (r.rating || 5) ? "currentColor" : "none"} style={{ verticalAlign: "-1px" }} />
              ))}
            </td>
            <td style={{ maxWidth: 320 }}>{r.texto}</td>
            <td>{r.estado === "oculto" ? <span className="tag pend">Oculta</span> : <span className="tag ok">Visible</span>}</td>
            <td className="t-mut">{r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-CO") : "—"}</td>
            <td style={{ whiteSpace: "nowrap" }}>
              <button className="btn-ico" title={r.estado === "oculto" ? "Mostrar" : "Ocultar"} disabled={busy === r.id} onClick={() => onToggle(r)}>
                {r.estado === "oculto" ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="btn-ico danger" title="Borrar" disabled={busy === r.id} onClick={() => onDelete(r.id)}>
                <Trash2 size={16} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

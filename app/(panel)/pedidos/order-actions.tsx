"use client";

import * as React from "react";
import { updateOrderStatus, despacharPedido, type DespachoResult } from "../actions";

const ESTADOS = ["pendiente_confirmacion", "confirmado", "despachado", "entregado", "pagado", "cancelado"];
const TRANSPORTADORAS = ["Interrapidísimo", "Servientrega", "Coordinadora", "Envía", "TCC", "Otra"];

export function OrderStatus({ id, estado }: { id: string; estado: string }) {
  const [val, setVal] = React.useState(estado);
  const [busy, setBusy] = React.useState(false);
  return (
    <select
      className="field"
      style={{ marginBottom: 0, padding: "7px 10px", fontSize: 12.5, opacity: busy ? 0.6 : 1 }}
      value={val}
      disabled={busy}
      onChange={async (e) => {
        const next = e.target.value;
        setVal(next); setBusy(true);
        await updateOrderStatus(id, next);
        setBusy(false);
      }}
    >
      {ESTADOS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
    </select>
  );
}

/** Texto de feedback tras intentar despachar + avisar. */
function feedback(res: DespachoResult): { tone: "ok" | "warn" | "err"; text: string } {
  if (!res.ok) return { tone: "err", text: res.error || "No se pudo despachar." };
  const n = res.notify;
  if (n?.ok) return { tone: "ok", text: "Despachado. Cliente avisado por WhatsApp ✅" };
  if (n?.sinConfig) return { tone: "warn", text: "Despachado ✅. UChat no está configurado: el cliente NO fue avisado (falta UCHAT_API_TOKEN)." };
  if (n?.sinSubId) return { tone: "warn", text: "Despachado ✅. El cliente no tiene WhatsApp vinculado (sin sub_id); no se envió aviso." };
  return { tone: "warn", text: `Despachado ✅. No se pudo avisar al cliente: ${n?.error || "error"}.` };
}

const TONE: Record<string, string> = { ok: "#0a7d33", warn: "#a86400", err: "#b3261e" };

/**
 * Control de despacho manual. Guarda guía + transportadora y avisa al cliente
 * por WhatsApp ("tu pedido fue despachado"). Muestra el estado del aviso.
 */
export function DispatchCell({
  id, guia, transportadora, despachadoAt, notificado,
}: {
  id: string; guia: string; transportadora: string; despachadoAt: string | null; notificado: boolean;
}) {
  const yaDespachado = !!despachadoAt;
  const [open, setOpen] = React.useState(!yaDespachado);
  const [g, setG] = React.useState(guia || "");
  const [t, setT] = React.useState(transportadora || "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tone: string; text: string } | null>(null);

  async function submit() {
    if (!g.trim()) { setMsg({ tone: "err", text: "Escribe el número de guía." }); return; }
    setBusy(true); setMsg(null);
    const res = await despacharPedido(id, g.trim(), t.trim());
    setBusy(false);
    setMsg(feedback(res));
  }

  return (
    <div style={{ minWidth: 210 }}>
      {yaDespachado && (
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          🚚 <b>{transportadora || "—"}</b>
          <div className="t-mut" style={{ fontSize: 11 }}>Guía: {guia || "—"}</div>
          <div style={{ fontSize: 11, color: notificado ? TONE.ok : TONE.warn }}>
            {notificado ? "Cliente avisado ✅" : "Cliente sin avisar ⚠️"}
          </div>
          {!open && (
            <button className="btn soft" style={{ padding: "3px 8px", fontSize: 11, marginTop: 2 }} onClick={() => setOpen(true)}>
              {notificado ? "Reenviar aviso / editar" : "Reintentar aviso"}
            </button>
          )}
        </div>
      )}

      {open && (
        <div style={{ display: "grid", gap: 4 }}>
          <input
            className="field" placeholder="N.º de guía" value={g}
            onChange={(e) => setG(e.target.value)} disabled={busy}
            style={{ marginBottom: 0, padding: "6px 8px", fontSize: 12 }}
          />
          <input
            className="field" placeholder="Transportadora" value={t} list={`transp-${id}`}
            onChange={(e) => setT(e.target.value)} disabled={busy}
            style={{ marginBottom: 0, padding: "6px 8px", fontSize: 12 }}
          />
          <datalist id={`transp-${id}`}>
            {TRANSPORTADORAS.map((x) => <option key={x} value={x} />)}
          </datalist>
          <button
            className="btn" onClick={submit} disabled={busy || !g.trim()}
            style={{ padding: "6px 10px", fontSize: 12, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Enviando…" : yaDespachado ? "Guardar y reavisar" : "🚚 Despachar y avisar"}
          </button>
        </div>
      )}

      {msg && (
        <div style={{ fontSize: 11, marginTop: 4, color: TONE[msg.tone] }}>{msg.text}</div>
      )}
    </div>
  );
}

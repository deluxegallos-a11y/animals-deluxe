"use client";

import * as React from "react";
import { updateOrderStatus } from "../actions";

const ESTADOS = ["pendiente_confirmacion", "confirmado", "despachado", "entregado", "pagado", "cancelado"];

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

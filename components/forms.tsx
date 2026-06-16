"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

/** Botón de envío que se deshabilita y muestra spinner mientras la action corre. */
export function SubmitButton({
  children,
  className = "btn",
  pendingText,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending} style={style}>
      {pending ? (
        <span className="btn-loading">
          <span className="spinner" />
          {pendingText ?? "Guardando…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/** Campo de texto/numérico con label, consistente con el sistema de diseño. */
export function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
  hint,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number;
  required?: boolean;
  hint?: string;
  min?: number;
  step?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}{required ? <span className="req"> *</span> : null}</label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        step={step}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/** Textarea con label. */
export function TextArea({
  label,
  name,
  placeholder,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} placeholder={placeholder} defaultValue={defaultValue} rows={rows} />
    </div>
  );
}

/**
 * Subida de imagen a Cloudinary vía /api/upload. Guarda la URL resultante
 * en un input hidden (name) que el form envía. Permite además pegar una URL
 * manual (fallback si Cloudinary no está configurado).
 */
export function ImageUpload({
  name,
  label,
  defaultUrl = "",
  folder = "products",
  hint,
}: {
  name: string;
  label: string;
  defaultUrl?: string;
  folder?: string;
  hint?: string;
}) {
  const [url, setUrl] = React.useState(defaultUrl);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok && json.url) setUrl(json.url);
      else setErr(json.mensaje || "No se pudo subir. Pega la URL manualmente.");
    } catch {
      setErr("No se pudo subir. Pega la URL manualmente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <label>{label}</label>
      <input type="hidden" name={name} value={url} readOnly />
      {url ? (
        <div style={{ marginBottom: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="preview" style={{ maxHeight: 120, borderRadius: 10, border: "1px solid #e5e9f2" }} />
        </div>
      ) : null}
      <input type="file" accept="image/*" onChange={onPick} disabled={busy} />
      {busy ? <span className="field-hint">Subiendo…</span> : null}
      <input
        type="url"
        placeholder="…o pega una URL de imagen"
        defaultValue={defaultUrl}
        onChange={(e) => setUrl(e.target.value.trim())}
        style={{ marginTop: 8 }}
      />
      {err ? <span className="field-hint" style={{ color: "#dc2626" }}>{err}</span> : null}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/** Toggle on/off (checkbox estilizado). */
export function Switch({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  hint?: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <span className="switch-label">{label}</span>
        {hint ? <span className="field-hint">{hint}</span> : null}
      </span>
      <span className="switch">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} />
        <span className="switch-track"><span className="switch-knob" /></span>
      </span>
    </label>
  );
}

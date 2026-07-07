"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderDetail as OD } from "@/lib/queries";
import { editarPedido, editarDimensionesProducto, cotizarPedido, crearGuia, obtenerPdfGuia, cancelarGuia, pasarAOrdenDeVenta, marcarCopiado, type Transportadora } from "../mp-actions";
import { despacharPedido, updateOrderStatus } from "../../actions";

const COP = (n: number) => "$" + Number(n || 0).toLocaleString("es-CO");
const abrirImpresion = (tipo: string, ref: string) => window.open(`/pedidos/imprimir?tipo=${tipo}&refs=${ref}`, "_blank");

const EST: Record<string, { label: string; color: string; bg: string }> = {
  remision: { label: "Remisión de venta", color: "#B54708", bg: "#FFF4E5" },
  aprobado: { label: "Orden de venta", color: "#067647", bg: "#ECFDF3" },
  guia: { label: "Con guía", color: "#1E50E6", bg: "#EAF0FF" },
  despachado: { label: "Despachado", color: "#6941C6", bg: "#F4EBFF" },
  entregado: { label: "Entregado", color: "#067647", bg: "#ECFDF3" },
  cancelado: { label: "Cancelado", color: "#B42318", bg: "#FEECEB" },
};
const CANAL: Record<string, string> = { whatsapp: "📱 WhatsApp", messenger: "💬 Messenger", web: "🌐 Página web", asesor: "🎧 Asesor" };

function mensajeWpp(o: OD, nombre: string, tel: string, cc: string, ciu: string, dir: string): string {
  const prod = o.items.map((i) => `${i.cantidad}× ${i.name}`).join(", ");
  const anticipado = o.metodoPago === "anticipado";
  return [
    `📦 *PEDIDO ${o.ref}* (${anticipado ? "pago anticipado" : "contra entrega"})`,
    `👤 ${nombre || "—"}`, `🪪 CC ${cc || "—"}`, `📱 ${tel || "—"}`,
    `📍 ${ciu || "—"} — ${dir || "—"}`, `🛒 ${prod || "—"}`,
    anticipado ? `💳 YA PAGÓ · ${COP(o.total)}` : `💵 A RECAUDAR: ${COP(o.total)}`,
  ].join("\n");
}

export function OrderDetail({ o }: { o: OD }) {
  const router = useRouter();
  const est = EST[o.estado] || EST.remision;
  const [toast, setToast] = React.useState("");
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2400); };

  // ---- Datos del cliente (editable) ----
  const [nombre, setNombre] = React.useState(o.nombre);
  const [tel, setTel] = React.useState(o.telefono);
  const [cc, setCc] = React.useState(o.cedula);
  const [ciu, setCiu] = React.useState(o.ciudad);
  const [dir, setDir] = React.useState(o.direccion);
  const [notas, setNotas] = React.useState(o.notas);
  const dirty = nombre !== o.nombre || tel !== o.telefono || cc !== o.cedula || ciu !== o.ciudad || dir !== o.direccion || notas !== o.notas;
  const [savingCli, setSavingCli] = React.useState(false);
  async function guardarCliente() {
    setSavingCli(true);
    await editarPedido(o.id, { nombre, telefono: tel, cedula: cc, ciudad: ciu, direccion: dir, notas });
    setSavingCli(false); flash("✅ Datos guardados"); router.refresh();
  }

  // ---- Método de pago ----
  const [pago, setPago] = React.useState(o.metodoPago);
  async function cambiarPago(m: string) { setPago(m); await editarPedido(o.id, { metodoPago: m }); flash(m === "anticipado" ? "Pago anticipado" : "Contra entrega"); router.refresh(); }

  // ---- Cotización + guía ----
  const [cotBusy, setCotBusy] = React.useState(false);
  const [transp, setTransp] = React.useState<Transportadora[]>([]);
  const [selT, setSelT] = React.useState("");
  const [sinDane, setSinDane] = React.useState(false);
  const [genBusy, setGenBusy] = React.useState(false);
  const [genErr, setGenErr] = React.useState("");
  async function cotizar() {
    setCotBusy(true); setGenErr("");
    const r = await cotizarPedido(o.id);
    setCotBusy(false);
    if (!r.ok) { setGenErr(r.error || "Error al cotizar"); return; }
    setSinDane(!!r.sinDane); const list = r.transportadoras || []; setTransp(list); if (list[0]) setSelT(list[0].id);
  }
  async function generar() {
    setGenBusy(true); setGenErr("");
    try {
      const r = await crearGuia(o.id, false, selT || transp[0]?.id || "");
      if (r.ok) { if (r.pdfUrl) { try { window.open(r.pdfUrl, "_blank"); } catch { /* */ } } flash(`Guía ${r.guideNumber || "generada"} ✅`); router.refresh(); }
      else setGenErr(r.error || "MiPaquete rechazó la guía.");
    } catch (e) { setGenErr("No se pudo conectar. " + String(e).slice(0, 60)); }
    finally { setGenBusy(false); }
  }
  const [pdfBusy, setPdfBusy] = React.useState(false);
  async function descargarGuia() {
    setPdfBusy(true);
    try {
      const r = await obtenerPdfGuia(o.id);
      if (r.ok && r.pdfUrl) { window.open(r.pdfUrl, "_blank"); if (!o.envioPdf) router.refresh(); }
      else flash(r.error || "No se pudo obtener la guía");
    } catch { flash("No se pudo conectar con MiPaquete"); }
    finally { setPdfBusy(false); }
  }
  const [cancBusy, setCancBusy] = React.useState(false);
  async function cancelarGuiaMp() {
    if (!confirm("¿Cancelar esta guía?\n\nOJO: MiPaquete no permite cancelar por API. Esto la cancela en la plataforma y podrás regenerarla, pero DEBES cancelarla también en el portal de MiPaquete para que no la despachen ni te la cobren.")) return;
    setCancBusy(true);
    try {
      const r = await cancelarGuia(o.id);
      if (r.ok) {
        if (r.avisoMp && r.portalUrl) {
          flash(`Cancelada aquí ✅ — ahora cancela la guía ${r.guideNumber} en MiPaquete`);
          if (confirm(`Guía cancelada en la plataforma.\n\nMiPaquete no cancela por API, así que abre su portal y cancela la guía N.º ${r.guideNumber} allá (para que no la despachen ni te la cobren).\n\n¿Abrir el portal de MiPaquete ahora?`)) window.open(r.portalUrl, "_blank");
        } else flash("Guía cancelada ✅");
        router.refresh();
      } else flash(r.error || "No se pudo cancelar");
    } catch { flash("No se pudo cancelar"); }
    finally { setCancBusy(false); }
  }

  // ---- Estado ----
  const [stBusy, setStBusy] = React.useState(false);
  const [guia, setGuia] = React.useState("");
  async function avanzar(fn: () => Promise<unknown>, msg: string) { setStBusy(true); await fn(); setStBusy(false); flash(msg); router.refresh(); }

  async function copiar() {
    try { await navigator.clipboard.writeText(mensajeWpp(o, nombre, tel, cc, ciu, dir)); await marcarCopiado([o.id]); flash("📋 Copiado a WhatsApp"); router.refresh(); }
    catch { flash("No se pudo copiar"); }
  }

  const falta = [!nombre && "nombre", !tel && "teléfono", !cc && "cédula", !ciu && "ciudad", !dir && "dirección"].filter(Boolean) as string[];

  return (
    <div className="od">
      {/* Top bar */}
      <div className="od-top">
        <Link href="/pedidos" className="od-back">← Pedidos</Link>
        <div className="od-title">
          <h1>{o.ref}</h1>
          <span className="od-badge" style={{ color: est.color, background: est.bg }}>{est.label}</span>
        </div>
        <div className="od-meta">
          <span>{CANAL[o.canal] || o.canal}</span>
          <span>{o.createdAt ? new Date(o.createdAt).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
          {o.facturaNumero ? <span>🧾 Factura #{o.facturaNumero}</span> : null}
        </div>
      </div>

      <div className="od-grid">
        {/* ---- Columna principal ---- */}
        <div className="od-main">
          {/* Cliente */}
          <section className="od-card">
            <div className="od-ch"><h2>Cliente y entrega</h2>{dirty ? <button className="od-btn primary sm" disabled={savingCli} onClick={guardarCliente}>{savingCli ? "Guardando…" : "Guardar cambios"}</button> : null}</div>
            {falta.length ? <div className="od-warn">⚠️ Faltan datos para despachar: {falta.join(", ")}</div> : null}
            <div className="od-fields">
              <Field label="Nombre completo" value={nombre} onChange={setNombre} />
              <Field label="Cédula" value={cc} onChange={setCc} hint="Interrapidísimo la exige" />
              <Field label="Teléfono" value={tel} onChange={setTel} />
              <Field label="Ciudad" value={ciu} onChange={setCiu} />
              <Field label="Dirección / oficina" value={dir} onChange={setDir} full />
            </div>
          </section>

          {/* Productos + dimensiones */}
          <section className="od-card">
            <div className="od-ch"><h2>Productos</h2><span className="od-sub">Dimensiones reales = flete correcto</span></div>
            <div className="od-prods">
              {o.items.map((it) => <ProductRow key={it.id} it={it} onSaved={() => { flash("📦 Dimensiones guardadas"); router.refresh(); }} />)}
            </div>
          </section>

          {/* Notas */}
          <section className="od-card">
            <div className="od-ch"><h2>Notas internas</h2></div>
            <textarea className="od-textarea" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones del pedido…" rows={2} />
          </section>
        </div>

        {/* ---- Sidebar ---- */}
        <div className="od-side">
          {/* Resumen */}
          <section className="od-card">
            <div className="od-ch"><h2>Resumen</h2></div>
            <div className="od-sum"><span>Subtotal</span><b>{COP(o.subtotal)}</b></div>
            {o.descuento ? <div className="od-sum"><span>Descuento</span><b style={{ color: "#067647" }}>−{COP(o.descuento)}</b></div> : null}
            <div className="od-sum"><span>Envío</span><b>{o.envio ? COP(o.envio) : "Incluido"}</b></div>
            <div className="od-sum total"><span>{pago === "anticipado" ? "Ya pagó" : "A recaudar"}</span><b>{COP(o.total)}</b></div>
            <div className="od-pago">
              <button className={pago !== "anticipado" ? "on" : ""} onClick={() => cambiarPago("contraentrega")}>Contra entrega</button>
              <button className={pago === "anticipado" ? "on" : ""} onClick={() => cambiarPago("anticipado")}>Anticipado</button>
            </div>
          </section>

          {/* Envío / Guía */}
          <section className="od-card">
            <div className="od-ch"><h2>🚚 Envío</h2></div>
            {o.envioGuia ? (
              <>
                <div className="od-guia">
                  <div className="od-sub">Guía {o.envioTransportadora}</div>
                  <div className="od-guianum">{o.envioGuia}</div>
                </div>
                <button className="od-btn primary" disabled={pdfBusy} onClick={descargarGuia}>{pdfBusy ? "Obteniendo…" : "📥 Descargar guía de MiPaquete"}</button>
                <button className="od-btn" onClick={() => abrirImpresion("guia", o.ref)}>🖨️ Imprimir (formato interno)</button>
                <button className="od-btn" onClick={() => window.open(`/pedidos/imprimir?tipo=guia&refs=${o.ref}&sticker=1`, "_blank")}>🏷️ Sticker 4×4 (térmica)</button>
                <button className="od-btn danger" disabled={cancBusy} onClick={cancelarGuiaMp}>{cancBusy ? "Cancelando…" : "❌ Cancelar guía"}</button>
              </>
            ) : !transp.length ? (
              <>
                <p className="od-note">Cotiza el envío con las transportadoras y genera la guía real (número + PDF).</p>
                {genErr ? <div className="od-err">⚠️ {genErr}</div> : null}
                <button className="od-btn primary" disabled={cotBusy || falta.length > 0} onClick={cotizar}>{cotBusy ? "Cotizando…" : falta.length ? "Completa los datos primero" : "Cotizar envío"}</button>
              </>
            ) : (
              <>
                {sinDane ? <div className="od-warn">No tengo el DANE de "{ciu}" — costo estimado local.</div> : null}
                <div className="od-transp">
                  {transp.map((t, i) => (
                    <label key={t.id + i} className={"od-tr" + (selT === t.id ? " on" : "")}>
                      <input type="radio" name="tr" checked={selT === t.id} onChange={() => setSelT(t.id)} />
                      <span className="nm">{t.company}{i === 0 ? <em> más barato</em> : null}</span>
                      <span className="pr">{COP(t.total)}</span>
                    </label>
                  ))}
                </div>
                {genErr ? <div className="od-err">⚠️ {genErr}</div> : null}
                <button className="od-btn primary" disabled={genBusy} onClick={generar}>{genBusy ? "Generando guía…" : "🚚 Generar guía"}</button>
                <button className="od-btn ghost" onClick={() => setTransp([])}>Cancelar</button>
              </>
            )}
          </section>

          {/* Acciones */}
          <section className="od-card">
            <div className="od-ch"><h2>Acciones</h2></div>
            {o.estado === "remision" && <button className="od-btn primary" disabled={stBusy || falta.length > 0} onClick={() => avanzar(() => pasarAOrdenDeVenta(o.id), "→ Orden de venta")}>✓ Pasar a orden de venta</button>}
            {o.estado === "guia" && (
              <div className="od-desp">
                <input placeholder="N.º guía (opcional)" value={guia} onChange={(e) => setGuia(e.target.value)} />
                <button className="od-btn primary" disabled={stBusy} onClick={() => avanzar(() => despacharPedido(o.id, guia, o.envioTransportadora || "Interrapidísimo"), "🚚 Despachado")}>Despachar</button>
              </div>
            )}
            <button className="od-btn" onClick={copiar}>📋 Copiar datos para WhatsApp</button>
            <button className="od-btn ghost" onClick={() => abrirImpresion("factura", o.ref)}>🖨️ Imprimir factura</button>
            {o.estado !== "cancelado" && o.estado !== "entregado"
              ? <button className="od-btn danger" disabled={stBusy} onClick={() => { if (confirm("¿Cancelar este pedido?")) avanzar(() => updateOrderStatus(o.id, "cancelado"), "Pedido cancelado"); }}>Cancelar pedido</button>
              : null}
          </section>
        </div>
      </div>

      {toast && <div className="od-toast">{toast}</div>}
    </div>
  );
}

function Field({ label, value, onChange, hint, full }: { label: string; value: string; onChange: (v: string) => void; hint?: string; full?: boolean }) {
  return (
    <div className={"od-field" + (full ? " full" : "")}>
      <label>{label}{hint ? <em> · {hint}</em> : null}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ProductRow({ it, onSaved }: { it: OD["items"][number]; onSaved: () => void }) {
  const [peso, setPeso] = React.useState(String(it.pesoGr));
  const [alto, setAlto] = React.useState(String(it.altoCm));
  const [ancho, setAncho] = React.useState(String(it.anchoCm));
  const [largo, setLargo] = React.useState(String(it.largoCm));
  const dirty = peso !== String(it.pesoGr) || alto !== String(it.altoCm) || ancho !== String(it.anchoCm) || largo !== String(it.largoCm);
  const [busy, setBusy] = React.useState(false);
  async function guardar() {
    setBusy(true);
    await editarDimensionesProducto(it.slug, { pesoGr: +peso || 1000, altoCm: +alto || 15, anchoCm: +ancho || 12, largoCm: +largo || 8 });
    setBusy(false); onSaved();
  }
  return (
    <div className="od-prod">
      <div className="od-prodtop">
        <div className="od-prodnm"><b>{it.cantidad}×</b> {it.name}{it.presentacion ? <span className="od-sub"> · {it.presentacion}</span> : null}</div>
        <div className="od-prodpr">{COP(it.precio * it.cantidad)}</div>
      </div>
      <div className="od-dims">
        <Dim label="Peso (g)" value={peso} onChange={setPeso} />
        <Dim label="Alto (cm)" value={alto} onChange={setAlto} />
        <Dim label="Ancho (cm)" value={ancho} onChange={setAncho} />
        <Dim label="Largo (cm)" value={largo} onChange={setLargo} />
        {dirty ? <button className="od-btn primary sm" disabled={busy} onClick={guardar}>{busy ? "…" : "Guardar"}</button> : null}
      </div>
    </div>
  );
}

function Dim({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="od-dim">
      <span>{label}</span>
      <input type="number" min={1} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

"use client";

/* Live Chat · bandeja (lista + hilo + ficha). Sondeo: lista cada 15 s, hilo
   abierto cada 4 s (línea IA) o 10 s (sin IA); se pausa con la pestaña oculta.
   Todo permiso se valida en el servidor; aquí solo se esconde lo que no aplica. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, FileText, Image as ImageIcon, Package, RefreshCw, Search, Send, Settings, StickyNote, UserRound, X,
} from "lucide-react";
import {
  asignarAsesor, borrarRespuestaRapida, configurarAsesor, devolverAlBot, enviarImagen, enviarMensaje, enviarPlantilla,
  enviarProducto, guardarRespuestaRapida, marcarLeido, notaInterna, plantillasDe, refrescarHilo, tomarChat, type Res,
} from "./acciones";

type EspacioUI = { codigo: string; nombre: string; conIa: boolean; reparto: boolean };
type Asesor = { id: string; nombre: string; email: string; activo: boolean; recibe_chats: boolean };
type Respuesta = { id: string; atajo: string; texto: string };
type Producto = { id: string; nombre: string; precio: number; imagen: string };
type Conv = {
  id: string; espacio: string; userNs: string; nombre: string; telefono: string; canal: string;
  ultimoTexto: string; ultimoEmisor: string; ultimoAt: string | null; ultimoClienteAt: string | null;
  sinLeer: number; owner: "bot" | "humano"; asesorId: string | null; botPausadoHasta: string | null;
  ventanaAbierta: boolean | null; customerId: string | null;
};
type Msg = {
  id: string; providerMsgId: string; direccion: "in" | "out" | "event";
  emisor: "cliente" | "ia" | "asesor_uchat" | "asesor_panel" | "sistema" | "nota";
  tipo: string; texto: string; mediaUrl: string; autor: string; providerTs: string;
};
type Cliente = { nombre: string | null; ciudad: string | null; departamento: string | null; estado: string | null; totalGastado: number | null; numPedidos: number | null; tags: unknown; notas: string | null } | null;
type Pedido = { ref: string; estado: string | null; totalCop: number | null; createdAt: string | null; guia: string | null; transportadora: string | null };
type Plantilla = { nombre: string; cuerpo: string; variables: number; noCompatible: string | null };
type Filtro = "todos" | "sin_leer" | "humano" | "mios" | "sin_asignar";

const cop = (n: number | null | undefined) => "$" + new Intl.NumberFormat("es-CO").format(n || 0);
const VENTANA_MS = 24 * 3600 * 1000;

function hace(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  if (s < 7 * 86400) return d.toLocaleDateString("es-CO", { weekday: "short" });
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}
function dia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}
function iniciales(n: string) {
  return (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
function telLegible(t: string) {
  const d = t.replace(/\D/g, "");
  return d.startsWith("57") && d.length === 12 ? `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : t ? `+${d}` : "";
}
function tomado(c: Conv) {
  return c.owner === "humano" && (!c.botPausadoHasta || new Date(c.botPausadoHasta) > new Date());
}
function ventana(c: Conv) {
  if (c.ventanaAbierta !== null && c.ventanaAbierta !== undefined) return c.ventanaAbierta;
  return !!c.ultimoClienteAt && Date.now() - new Date(c.ultimoClienteAt).getTime() < VENTANA_MS;
}
function rellenar(t: string, v: { nombre: string; asesor: string }) {
  const primer = v.nombre.trim().split(/\s+/)[0] || "";
  return t.replace(/\{nombre\}/gi, primer).replace(/\{asesor\}/gi, v.asesor).replace(/\s+([,.!?])/g, "$1").replace(/ {2,}/g, " ").trim();
}
const ICONO_EMISOR: Record<string, string> = { cliente: "", ia: "🤖 ", asesor_uchat: "🧑‍💼 ", asesor_panel: "🧑‍💼 " };

function useVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const f = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return v;
}

export function LivechatUI(props: {
  rol: "admin" | "asesor";
  yo: { asesorId: string | null; nombre: string };
  espacios: EspacioUI[];
  asesores: Asesor[];
  respuestas: Respuesta[];
  productos: Producto[];
}) {
  const { rol, yo, espacios, asesores, productos } = props;
  const visible = useVisible();
  const [espacio, setEspacio] = useState(espacios[0].codigo);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<Conv[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorSync, setErrorSync] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [respuestas, setRespuestas] = useState(props.respuestas);
  const [ajustes, setAjustes] = useState(false);
  const esp = espacios.find((e) => e.codigo === espacio)!;
  const nombreAsesor = useMemo(() => Object.fromEntries(asesores.map((a) => [a.id, a.nombre])), [asesores]);

  const cargarLista = useCallback(async (opts: { forzar?: boolean; sync?: boolean } = {}) => {
    const p = new URLSearchParams({ espacio, filtro, q });
    if (opts.forzar) p.set("forzar", "1");
    if (opts.sync === false) p.set("sync", "0");
    try {
      const r = await fetch(`/api/livechat/bandeja?${p}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setLista(j.conversaciones); setErrorSync(j.error || ""); }
      else setErrorSync(j.error || "Error leyendo la bandeja");
    } catch { setErrorSync("Sin conexión"); }
    setCargandoLista(false);
  }, [espacio, filtro, q]);

  // Al cambiar de pestaña/filtro: pinta lo guardado ya y luego sincroniza.
  useEffect(() => {
    setCargandoLista(true);
    cargarLista({ sync: false }).then(() => cargarLista());
  }, [cargarLista]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => cargarLista(), 15000);
    return () => clearInterval(t);
  }, [visible, cargarLista]);

  const convSel = lista.find((c) => c.id === sel) || null;

  return (
    <div className={`lc ${sel ? "con-hilo" : ""}`}>
      <aside className="lc-lista">
        <div className="lc-lista-top">
          <div className="lc-tabs">
            {espacios.map((e) => (
              <button key={e.codigo} className={`lc-tab ${e.codigo === espacio ? "on" : ""}`} onClick={() => { setEspacio(e.codigo); setSel(null); }}>
                {e.conIa ? <Bot size={15} /> : <UserRound size={15} />} {e.nombre}
              </button>
            ))}
            {rol === "admin" ? <button className="lc-ico" title="Ajustes del Live Chat" onClick={() => setAjustes(true)}><Settings size={16} /></button> : null}
          </div>
          <div className="lc-buscar">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, teléfono o texto" />
            <button className="lc-ico" title="Actualizar desde UChat" onClick={() => cargarLista({ forzar: true })}><RefreshCw size={15} /></button>
          </div>
          <div className="lc-filtros">
            {([
              ["todos", "Todos"], ["sin_leer", "Sin leer"], ["humano", esp.conIa ? "Tomados" : "Atendidos"],
              ...(rol === "admin" ? [["sin_asignar", "Sin asignar"]] : [["mios", "Míos"]]),
            ] as [Filtro, string][]).map(([k, l]) => (
              <button key={k} className={`lc-chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>{l}</button>
            ))}
          </div>
          {errorSync ? <div className="lc-error" title={errorSync}>⚠️ {errorSync}</div> : null}
        </div>
        <div className="lc-items">
          {cargandoLista && !lista.length ? <div className="lc-vacio">Cargando…</div> : null}
          {!cargandoLista && !lista.length ? <div className="lc-vacio">No hay conversaciones aquí.</div> : null}
          {lista.map((c) => (
            <button key={c.id} className={`lc-item ${c.id === sel ? "on" : ""}`} onClick={() => setSel(c.id)}>
              <span className={`lc-av ${tomado(c) ? "humano" : ""}`}>{iniciales(c.nombre || c.telefono)}</span>
              <span className="lc-item-cuerpo">
                <span className="lc-item-fila">
                  <b>{c.nombre || telLegible(c.telefono) || "Cliente"}</b>
                  <small>{hace(c.ultimoAt)}</small>
                </span>
                <span className="lc-item-fila">
                  <span className="lc-prev">{ICONO_EMISOR[c.ultimoEmisor] || ""}{c.ultimoTexto || <i>Sin mensajes cargados</i>}</span>
                  {c.sinLeer > 0 ? <span className="lc-badge">{c.sinLeer}</span> : null}
                </span>
                <span className="lc-item-tags">
                  {esp.conIa ? (tomado(c) ? <em className="t-hum">Humano</em> : <em className="t-bot">Bot</em>) : null}
                  {c.asesorId ? <em>{nombreAsesor[c.asesorId] || "Asesor"}</em> : null}
                  {c.canal && c.canal !== "whatsapp" ? <em>{c.canal}</em> : null}
                  {!ventana(c) ? <em className="t-cerr">24 h cerrada</em> : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {convSel ? (
        <Hilo
          key={convSel.id}
          conv={convSel}
          esp={esp}
          rol={rol}
          yo={yo}
          asesores={asesores}
          respuestas={respuestas}
          productos={productos}
          visible={visible}
          onVolver={() => setSel(null)}
          onCambio={() => cargarLista({ sync: false })}
        />
      ) : (
        <section className="lc-hilo lc-hilo-vacio">
          <div className="empty"><div className="ico">💬</div><h4>Elige una conversación</h4>
            <p>{esp.conIa ? "Aquí ves lo que el bot habla con cada cliente. Escribe o «Toma» el chat para atenderlo tú; el bot queda en pausa." : "Chats de la línea de asesores, repartidos de forma equitativa."}</p>
          </div>
        </section>
      )}

      {ajustes ? <Ajustes asesores={asesores} respuestas={respuestas} setRespuestas={setRespuestas} onCerrar={() => setAjustes(false)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Hilo(props: {
  conv: Conv; esp: EspacioUI; rol: "admin" | "asesor"; yo: { asesorId: string | null; nombre: string };
  asesores: Asesor[]; respuestas: Respuesta[]; productos: Producto[]; visible: boolean;
  onVolver: () => void; onCambio: () => void;
}) {
  const { esp, rol, yo, asesores, respuestas, productos, visible, onVolver, onCambio } = props;
  const [conv, setConv] = useState<Conv>(props.conv);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [cliente, setCliente] = useState<Cliente>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [modoNota, setModoNota] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "err"; t: string } | null>(null);
  const [panel, setPanel] = useState<"" | "producto" | "imagen" | "plantilla">("");
  const [verFicha, setVerFicha] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const ultimoId = useRef("");

  const cargar = useCallback(async (sync = true) => {
    try {
      const r = await fetch(`/api/livechat/hilo?id=${conv.id}${sync ? "" : "&sync=0"}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setMensajes(j.mensajes); setConv(j.conversacion); setCliente(j.cliente); setPedidos(j.pedidos || []);
      } else setAviso({ tipo: "err", t: j.error });
    } catch { /* reintenta en el siguiente ciclo */ }
    setCargando(false);
  }, [conv.id]);

  useEffect(() => {
    cargar(false).then(() => cargar());
    marcarLeido(conv.id).then(() => onCambio());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => cargar(), esp.conIa ? 4000 : 10000);
    return () => clearInterval(t);
  }, [visible, cargar, esp.conIa]);
  useEffect(() => {
    const u = mensajes[mensajes.length - 1]?.id || "";
    if (u !== ultimoId.current) {
      ultimoId.current = u;
      finRef.current?.scrollIntoView({ block: "end" });
    }
  }, [mensajes]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tipo === "ok" ? 2500 : 7000);
    return () => clearTimeout(t);
  }, [aviso]);

  async function correr(fn: () => Promise<Res>, ok?: string) {
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (r.ok) { if (ok) setAviso({ tipo: "ok", t: ok }); await cargar(false); onCambio(); }
    else setAviso({ tipo: "err", t: r.error });
    return r.ok;
  }

  const abierta = ventana(conv);
  const esTomado = tomado(conv);
  const sugerencias = texto.startsWith("/") && !texto.includes(" ")
    ? respuestas.filter((r) => r.atajo.startsWith(texto.slice(1).toLowerCase())).slice(0, 6) : [];

  async function enviar() {
    const t = texto.trim();
    if (!t || ocupado) return;
    const ok = modoNota ? await correr(() => notaInterna(conv.id, t)) : await correr(() => enviarMensaje(conv.id, t));
    if (ok) setTexto("");
  }

  // Agrupa por día para los separadores.
  const bloques: { dia: string; items: Msg[] }[] = [];
  for (const m of mensajes) {
    const d = dia(m.providerTs);
    if (!bloques.length || bloques[bloques.length - 1].dia !== d) bloques.push({ dia: d, items: [] });
    bloques[bloques.length - 1].items.push(m);
  }

  return (
    <>
      <section className="lc-hilo">
        <header className="lc-hilo-top">
          <button className="lc-ico lc-solo-movil" onClick={onVolver} title="Volver"><ArrowLeft size={18} /></button>
          <span className={`lc-av ${esTomado ? "humano" : ""}`}>{iniciales(conv.nombre || conv.telefono)}</span>
          <div className="lc-hilo-quien" onClick={() => setVerFicha((v) => !v)}>
            <b>{conv.nombre || "Cliente"}</b>
            <small>{telLegible(conv.telefono)} · {conv.canal}{esp.conIa ? (esTomado ? ` · 🧑‍💼 tomado${conv.botPausadoHasta ? ` hasta ${hora(conv.botPausadoHasta)}` : ""}` : " · 🤖 bot activo") : ""}</small>
          </div>
          <div className="lc-hilo-acc">
            {rol === "admin" ? (
              <select value={conv.asesorId || ""} disabled={ocupado} onChange={(e) => correr(() => asignarAsesor(conv.id, e.target.value || null), "Asignado")}>
                <option value="">Sin asesor</option>
                {asesores.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            ) : null}
            {esp.conIa ? (
              esTomado
                ? <button className="lc-btn soft" disabled={ocupado} onClick={() => correr(() => devolverAlBot(conv.id), "El bot vuelve a responder")}><Bot size={15} /> Devolver al bot</button>
                : <button className="lc-btn" disabled={ocupado} onClick={() => correr(() => tomarChat(conv.id), "Chat tomado: el bot queda en pausa")}><UserRound size={15} /> Tomar chat</button>
            ) : null}
            <button className="lc-ico" title="Traer de UChat ahora" disabled={ocupado} onClick={() => correr(() => refrescarHilo(conv.id))}><RefreshCw size={15} /></button>
            <button className="lc-ico" title="Ficha del cliente" onClick={() => setVerFicha((v) => !v)}><FileText size={15} /></button>
          </div>
        </header>

        <div className="lc-msgs">
          {cargando && !mensajes.length ? <div className="lc-vacio">Cargando conversación…</div> : null}
          {bloques.map((b) => (
            <div key={b.dia}>
              <div className="lc-dia"><span>{b.dia}</span></div>
              {b.items.map((m) => <Burbuja key={m.id} m={m} />)}
            </div>
          ))}
          <div ref={finRef} />
        </div>

        {aviso ? <div className={`lc-aviso ${aviso.tipo}`}>{aviso.t}</div> : null}

        {panel === "producto" ? <PanelProducto productos={productos} onCerrar={() => setPanel("")} onElegir={async (p) => { if (await correr(() => enviarProducto(conv.id, p.id), `${p.nombre} enviado`)) setPanel(""); }} /> : null}
        {panel === "imagen" ? <PanelImagen onCerrar={() => setPanel("")} onEnviar={async (u, pie) => { if (await correr(() => enviarImagen(conv.id, u, pie), "Imagen enviada")) setPanel(""); }} /> : null}
        {panel === "plantilla" ? <PanelPlantilla convId={conv.id} nombre={conv.nombre} onCerrar={() => setPanel("")} onEnviar={async (n, v) => { if (await correr(() => enviarPlantilla(conv.id, n, v), "Plantilla enviada")) setPanel(""); }} /> : null}

        <footer className={`lc-comp ${modoNota ? "nota" : ""}`}>
          {!abierta && !modoNota ? (
            <div className="lc-cerrada">
              <span>⏰ Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo deja enviar <b>plantillas aprobadas</b>.</span>
              <button className="lc-btn" onClick={() => setPanel("plantilla")}><FileText size={15} /> Enviar plantilla</button>
              <button className="lc-btn soft" onClick={() => setModoNota(true)}><StickyNote size={15} /> Nota interna</button>
            </div>
          ) : (
            <>
              {sugerencias.length ? (
                <div className="lc-sug">
                  {sugerencias.map((r) => (
                    <button key={r.id} onClick={() => setTexto(rellenar(r.texto, { nombre: conv.nombre, asesor: yo.nombre }))}>
                      <b>/{r.atajo}</b> <span>{r.texto}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {esp.conIa && !esTomado && !modoNota ? <div className="lc-nota-bot">Al enviar, el chat queda <b>tomado</b> y el bot en pausa 12 h. Para devolvérselo usa «Devolver al bot».</div> : null}
              <div className="lc-comp-fila">
                <div className="lc-herr">
                  <button className={`lc-ico ${modoNota ? "on" : ""}`} title="Nota interna (el cliente no la ve)" onClick={() => setModoNota((v) => !v)}><StickyNote size={16} /></button>
                  {!modoNota ? <>
                    <button className="lc-ico" title="Enviar producto" onClick={() => setPanel(panel === "producto" ? "" : "producto")}><Package size={16} /></button>
                    <button className="lc-ico" title="Enviar imagen" onClick={() => setPanel(panel === "imagen" ? "" : "imagen")}><ImageIcon size={16} /></button>
                    <button className="lc-ico" title="Plantilla de WhatsApp" onClick={() => setPanel(panel === "plantilla" ? "" : "plantilla")}><FileText size={16} /></button>
                  </> : null}
                </div>
                <textarea
                  value={texto}
                  rows={1}
                  placeholder={modoNota ? "Nota interna para el equipo…" : "Escribe un mensaje · «/» respuestas rápidas"}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (sugerencias.length && texto.startsWith("/")) setTexto(rellenar(sugerencias[0].texto, { nombre: conv.nombre, asesor: yo.nombre }));
                      else enviar();
                    }
                  }}
                />
                <button className="lc-enviar" disabled={ocupado || !texto.trim()} onClick={enviar} title={modoNota ? "Guardar nota" : "Enviar"}>
                  {modoNota ? <StickyNote size={17} /> : <Send size={17} />}
                </button>
              </div>
            </>
          )}
        </footer>
      </section>

      <aside className={`lc-ficha ${verFicha ? "abierta" : ""}`}>
        <div className="lc-ficha-top"><b>Ficha</b><button className="lc-ico lc-solo-movil" onClick={() => setVerFicha(false)}><X size={16} /></button></div>
        <dl>
          <dt>Cliente</dt><dd>{conv.nombre || "—"}</dd>
          <dt>WhatsApp</dt><dd>{conv.telefono ? <a href={`https://wa.me/${conv.telefono}`} target="_blank" rel="noreferrer">{telLegible(conv.telefono)}</a> : "—"}</dd>
          <dt>Ventana 24 h</dt><dd>{abierta ? <span className="t-ok">Abierta</span> : <span className="t-cerr">Cerrada</span>}</dd>
          {esp.conIa ? <><dt>Quién responde</dt><dd>{esTomado ? "Humano (bot en pausa)" : "Bot IA"}</dd></> : null}
          <dt>Asesor</dt><dd>{asesores.find((a) => a.id === conv.asesorId)?.nombre || "Sin asignar"}</dd>
        </dl>
        <h5>CRM</h5>
        {cliente ? (
          <dl>
            <dt>Ciudad</dt><dd>{[cliente.ciudad, cliente.departamento].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Estado</dt><dd>{cliente.estado || "—"}</dd>
            <dt>Compras</dt><dd>{cliente.numPedidos || 0} · {cop(cliente.totalGastado)}</dd>
            {Array.isArray(cliente.tags) && cliente.tags.length ? <><dt>Etiquetas</dt><dd>{(cliente.tags as string[]).join(", ")}</dd></> : null}
            {cliente.notas ? <><dt>Notas</dt><dd>{cliente.notas}</dd></> : null}
          </dl>
        ) : <p className="lc-mut">Todavía no está en el CRM (se crea cuando el bot registra al cliente o hace un pedido).</p>}
        <h5>Pedidos</h5>
        {pedidos.length ? (
          <ul className="lc-pedidos">
            {pedidos.map((p) => (
              <li key={p.ref}>
                <a href={`/pedidos?q=${encodeURIComponent(p.ref)}`}><b>{p.ref}</b></a> · {cop(p.totalCop)}
                <small>{p.estado}{p.guia ? ` · ${p.transportadora || "guía"} ${p.guia}` : ""}{p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString("es-CO")}` : ""}</small>
              </li>
            ))}
          </ul>
        ) : <p className="lc-mut">Sin pedidos.</p>}
        <p className="lc-mut lc-ns">UChat: {conv.userNs}</p>
      </aside>
    </>
  );
}

function Burbuja({ m }: { m: Msg }) {
  if (m.emisor === "sistema") return <div className="lc-evento">{m.texto} · {hora(m.providerTs)}</div>;
  if (m.emisor === "nota") return <div className="lc-notai"><b>📝 Nota de {m.autor || "equipo"}</b><p>{m.texto}</p><small>{hora(m.providerTs)}</small></div>;
  const lado = m.emisor === "cliente" ? "izq" : "der";
  const pendiente = m.providerMsgId.startsWith("panel:");
  const quien = m.emisor === "ia" ? "🤖 Bot IA" : m.emisor === "cliente" ? "" : `🧑‍💼 ${m.autor || "Asesor"}`;
  return (
    <div className={`lc-b ${lado} ${m.emisor}`}>
      {quien ? <span className="lc-b-quien">{quien}</span> : null}
      {m.tipo === "image" && m.mediaUrl ? <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt="" loading="lazy" /></a> : null}
      {m.tipo === "video" && m.mediaUrl ? <video src={m.mediaUrl} controls preload="none" /> : null}
      {m.tipo === "audio" && m.mediaUrl ? <audio src={m.mediaUrl} controls preload="none" /> : null}
      {m.tipo === "file" && m.mediaUrl ? <a className="lc-archivo" href={m.mediaUrl} target="_blank" rel="noreferrer">📎 Abrir archivo</a> : null}
      {m.texto ? <p className={m.tipo === "audio" ? "lc-transc" : ""}>{m.tipo === "audio" ? `«${m.texto}»` : m.texto}</p> : null}
      <small>{hora(m.providerTs)}{pendiente ? " · enviando…" : m.direccion === "out" ? " ✓" : ""}</small>
    </div>
  );
}

function PanelProducto({ productos, onElegir, onCerrar }: { productos: Producto[]; onElegir: (p: Producto) => void; onCerrar: () => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const lista = productos.filter((p) => !t || p.nombre.toLowerCase().includes(t)).slice(0, 40);
  return (
    <div className="lc-panel">
      <div className="lc-panel-top"><b>Enviar producto</b><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" /><button className="lc-ico" onClick={onCerrar}><X size={15} /></button></div>
      <div className="lc-prods">
        {lista.map((p) => (
          <button key={p.id} onClick={() => onElegir(p)} title="Envía la foto + la ficha con precio y forma de pago">
            {p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <span className="lc-noimg">📦</span>}
            <span>{p.nombre}</span><small>{cop(p.precio)}</small>
          </button>
        ))}
        {!lista.length ? <p className="lc-mut">Nada coincide.</p> : null}
      </div>
    </div>
  );
}

function PanelImagen({ onEnviar, onCerrar }: { onEnviar: (url: string, pie: string) => void; onCerrar: () => void }) {
  const [url, setUrl] = useState("");
  const [pie, setPie] = useState("");
  return (
    <div className="lc-panel">
      <div className="lc-panel-top"><b>Enviar imagen</b><button className="lc-ico" onClick={onCerrar}><X size={15} /></button></div>
      <div className="lc-form">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (enlace público de la imagen)" />
        <input value={pie} onChange={(e) => setPie(e.target.value)} placeholder="Texto que va después (opcional)" />
        <button className="lc-btn" disabled={!/^https:\/\//.test(url)} onClick={() => onEnviar(url, pie)}><Send size={14} /> Enviar</button>
      </div>
    </div>
  );
}

function PanelPlantilla({ convId, nombre, onEnviar, onCerrar }: { convId: string; nombre: string; onEnviar: (n: string, v: string[]) => void; onCerrar: () => void }) {
  const [lista, setLista] = useState<Plantilla[] | null>(null);
  const [err, setErr] = useState("");
  const [elegida, setElegida] = useState<Plantilla | null>(null);
  const [vals, setVals] = useState<string[]>([]);
  useEffect(() => {
    plantillasDe(convId).then((r) => (r.ok ? setLista((r.data as Plantilla[]) || []) : setErr(r.error)));
  }, [convId]);
  function elegir(p: Plantilla) {
    setElegida(p);
    setVals(Array.from({ length: p.variables }, (_, i) => (i === 0 ? nombre.trim().split(/\s+/)[0] || "" : "")));
  }
  let vista = elegida?.cuerpo || "";
  vals.forEach((v, i) => { vista = vista.replaceAll(`{{${i + 1}}}`, v || `{{${i + 1}}}`); });
  return (
    <div className="lc-panel">
      <div className="lc-panel-top"><b>Plantillas de WhatsApp</b><button className="lc-ico" onClick={onCerrar}><X size={15} /></button></div>
      {err ? <p className="lc-error">{err}</p> : null}
      {!lista && !err ? <p className="lc-mut">Cargando plantillas de UChat…</p> : null}
      {lista && !elegida ? (
        <div className="lc-plantillas">
          {lista.map((p) => (
            <button key={p.nombre} disabled={!!p.noCompatible} onClick={() => elegir(p)} title={p.noCompatible || ""}>
              <b>{p.nombre}</b><span>{p.cuerpo}</span>{p.noCompatible ? <small>{p.noCompatible}</small> : null}
            </button>
          ))}
          {!lista.length ? <p className="lc-mut">No hay plantillas en este workspace.</p> : null}
        </div>
      ) : null}
      {elegida ? (
        <div className="lc-form">
          <div className="lc-vista">{vista}</div>
          {vals.map((v, i) => (
            <input key={i} value={v} placeholder={`Variable {{${i + 1}}}`} onChange={(e) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="lc-btn soft" onClick={() => setElegida(null)}>Atrás</button>
            <button className="lc-btn" disabled={vals.some((v) => !v.trim())} onClick={() => onEnviar(elegida.nombre, vals)}><Send size={14} /> Enviar plantilla</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Ajustes({ asesores, respuestas, setRespuestas, onCerrar }: {
  asesores: Asesor[]; respuestas: Respuesta[]; setRespuestas: (r: Respuesta[]) => void; onCerrar: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [atajo, setAtajo] = useState("");
  const [txt, setTxt] = useState("");
  const [cfg, setCfg] = useState(() => Object.fromEntries(asesores.map((a) => [a.id, { email: a.email, recibe: a.recibe_chats }])));
  async function guardarR() {
    const r = await guardarRespuestaRapida(atajo, txt);
    if (!r.ok || !r.data) return setMsg(r.ok ? "No se pudo guardar" : r.error);
    const { id, atajo: a } = r.data;
    setRespuestas([...respuestas.filter((x) => x.atajo !== a), { id, atajo: a, texto: txt.trim() }].sort((x, y) => x.atajo.localeCompare(y.atajo)));
    setAtajo(""); setTxt(""); setMsg("Respuesta guardada");
  }
  return (
    <div className="lc-modal-ov" onClick={onCerrar}>
      <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lc-panel-top"><b>Ajustes del Live Chat</b><button className="lc-ico" onClick={onCerrar}><X size={16} /></button></div>
        {msg ? <div className="lc-aviso ok" style={{ position: "static" }}>{msg}</div> : null}
        <h5>Asesores</h5>
        <p className="lc-mut">El correo es con el que el asesor entra al panel: verá solo sus chats de la línea de asesores. «Recibe chats» lo incluye en el reparto equitativo.</p>
        <div className="lc-ases">
          {asesores.map((a) => (
            <div key={a.id} className="lc-ases-fila">
              <b>{a.nombre}</b>
              <input value={cfg[a.id]?.email || ""} placeholder="correo@…" onChange={(e) => setCfg({ ...cfg, [a.id]: { ...cfg[a.id], email: e.target.value } })} />
              <label><input type="checkbox" checked={!!cfg[a.id]?.recibe} onChange={(e) => setCfg({ ...cfg, [a.id]: { ...cfg[a.id], recibe: e.target.checked } })} /> Recibe chats</label>
              <button className="lc-btn soft" onClick={async () => { const r = await configurarAsesor(a.id, cfg[a.id].email, cfg[a.id].recibe); setMsg(r.ok ? `${a.nombre} guardado` : r.error); }}>Guardar</button>
            </div>
          ))}
          {!asesores.length ? <p className="lc-mut">Crea asesores en la sección Asesores.</p> : null}
        </div>
        <h5>Respuestas rápidas</h5>
        <p className="lc-mut">Se usan escribiendo «/atajo» en el chat. Puedes usar {"{nombre}"} y {"{asesor}"}.</p>
        <div className="lc-rr">
          {respuestas.map((r) => (
            <div key={r.id} className="lc-rr-fila">
              <b>/{r.atajo}</b><span>{r.texto}</span>
              <button className="lc-ico" title="Borrar" onClick={async () => { const x = await borrarRespuestaRapida(r.id); if (x.ok) setRespuestas(respuestas.filter((y) => y.id !== r.id)); else setMsg(x.error); }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="lc-form">
          <input value={atajo} onChange={(e) => setAtajo(e.target.value)} placeholder="atajo (ej. envio)" />
          <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Texto de la respuesta" rows={3} />
          <button className="lc-btn" disabled={!atajo.trim() || !txt.trim()} onClick={guardarR}>Guardar respuesta</button>
        </div>
      </div>
    </div>
  );
}

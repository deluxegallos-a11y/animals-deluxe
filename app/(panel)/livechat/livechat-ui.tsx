"use client";

/* Live Chat · bandeja «Neo AI Pro» (calidad de la bandeja de Tienda Core).
   Una superficie flotante: lista (352) · hilo · ficha (330). Sondeo: lista cada
   15 s, hilo abierto cada 4 s (línea IA) o 10 s (sin IA); se pausa con la
   pestaña oculta. Los permisos se validan en el servidor. Los números de «Hoy»
   salen de lib/livechat/resumen.ts — los MISMOS que muestra el dashboard. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Check, Copy, ExternalLink, FileText, Hand, Image as ImageIcon, Package, PanelRight,
  RefreshCw, Search, Send, Settings, StickyNote, UserRound, X, Zap,
} from "lucide-react";
import {
  asignarAsesor, borrarRespuestaRapida, configurarAsesor, devolverAlBot, enviarImagen, enviarMensaje, enviarPlantilla,
  enviarProducto, guardarRespuestaRapida, notaInterna, plantillasDe, refrescarHilo, tomarChat, type Res,
} from "./acciones";
import { ETAPAS, esConfirmado, etapaDe, pidioAsesor, type Etapa } from "@/lib/livechat/puro";
import { CaraNeo, EnVivo, NeoEscribiendo, PoweredNeo } from "@/components/neo";

type EspacioUI = { codigo: string; nombre: string; conIa: boolean; reparto: boolean };
type Asesor = { id: string; nombre: string; email: string; activo: boolean; recibe_chats: boolean };
type Respuesta = { id: string; atajo: string; texto: string };
type Producto = { id: string; nombre: string; precio: number; imagen: string };
type Conv = {
  id: string; espacio: string; userNs: string; nombre: string; telefono: string; canal: string;
  ultimoTexto: string; ultimoEmisor: string; ultimoAt: string | null; ultimoClienteAt: string | null;
  sinLeer: number; owner: "bot" | "humano"; asesorId: string | null; botPausadoHasta: string | null;
  ventanaAbierta: boolean | null; customerId: string | null;
  etiquetas: string[]; pedidoId: string | null; pedidoRef: string; pedidoEstado: string; pedidoTotal: number;
  pedidoAt: string | null; pedidosNum: number; mensajesSyncAt: string | null;
};
type Msg = {
  id: string; providerMsgId: string; direccion: "in" | "out" | "event";
  emisor: "cliente" | "ia" | "asesor_uchat" | "asesor_panel" | "sistema" | "nota";
  tipo: string; texto: string; mediaUrl: string; autor: string; providerTs: string;
};
type Cliente = {
  nombre: string | null; ciudad: string | null; departamento: string | null; direccion: string | null; estado: string | null;
  totalGastado: number | null; numPedidos: number | null; tags: unknown; notas: string | null; ultimoProductoVisto: string | null;
} | null;
type Pedido = {
  id: string; ref: string; estado: string | null; totalCop: number | null; createdAt: string | null; guia: string | null;
  transportadora: string | null; ciudad: string | null; direccion: string | null; paymentType: string | null; items: string[];
};
type Plantilla = { nombre: string; cuerpo: string; variables: number; noCompatible: string | null };
type Filtro = "todos" | "sin_leer" | "confirmados" | "asesor" | "humano" | "mios" | "sin_asignar";
type Contadores = Record<Filtro, number>;
type Resumen = { chats: number; pedidos: number; ventasCop: number; sinResponder: number; pidenAsesor: number };

const cop = (n: number | null | undefined) => "$" + new Intl.NumberFormat("es-CO").format(n || 0);
const VENTANA_MS = 24 * 3600 * 1000;
const ESTADO_PEDIDO: Record<string, { label: string; tono: string }> = {
  remision: { label: "En remisión", tono: "ok" },
  por_revisar: { label: "Por revisar", tono: "vigilar" },
  aprobado: { label: "Aprobado", tono: "ok" },
  guia: { label: "Con guía", tono: "marca" },
  despachado: { label: "Despachado", tono: "marca" },
  entregado: { label: "Entregado", tono: "marca" },
  cancelado: { label: "Cancelado", tono: "urgente" },
};
const PASOS: Etapa[] = ["nuevo", "interesado", "datos", "confirmado", "aprobado", "despachado"];
/* Avatares en la familia de la marca (azul eléctrico, azul noche y grafito), sin arcoíris. */
const TONOS = [
  ["#4F7FFF", "#0047FF"], ["#1A2A6B", "#030920"], ["#3A3D4A", "#16171D"], ["#8AABFF", "#2F6BFF"],
  ["#0047FF", "#0A1747"], ["#5A5D6B", "#2A2C35"], ["#2F6BFF", "#0038CC"], ["#22305F", "#0A1433"],
];
function tono(semilla: string) {
  let h = 0;
  for (let i = 0; i < semilla.length; i++) h = (h * 31 + semilla.charCodeAt(i)) >>> 0;
  const [a, b] = TONOS[h % TONOS.length];
  return `linear-gradient(140deg,${a},${b})`;
}

function hace(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400 && d.getDate() === new Date().getDate()) return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  if (s < 7 * 86400) return d.toLocaleDateString("es-CO", { weekday: "short" });
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "");
function dia(iso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date().toDateString()) return "Hoy";
  if (d.toDateString() === new Date(Date.now() - 86400000).toDateString()) return "Ayer";
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}
function iniciales(n: string) {
  const limpio = (n || "").replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const ini = limpio.split(/\s+/).slice(0, 2).map((p) => Array.from(p)[0]?.toUpperCase() || "").join("");
  if (ini) return ini;
  // Nombres de WhatsApp hechos solo de emoji («🕶️», «🚀»): se muestra el primer emoji.
  const emoji = (n || "").match(/\p{Extended_Pictographic}/u)?.[0];
  return emoji || "·";
}
function telLegible(t: string) {
  const d = (t || "").replace(/\D/g, "");
  if (d.startsWith("57") && d.length === 12) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return d ? `+${d}` : "";
}
const tomado = (c: Conv) => c.owner === "humano" && (!c.botPausadoHasta || new Date(c.botPausadoHasta) > new Date());
function ventana(c: Conv) {
  if (c.ventanaAbierta !== null && c.ventanaAbierta !== undefined) return c.ventanaAbierta;
  return !!c.ultimoClienteAt && Date.now() - new Date(c.ultimoClienteAt).getTime() < VENTANA_MS;
}
function rellenar(t: string, v: { nombre: string; asesor: string }) {
  const primer = v.nombre.trim().split(/\s+/)[0] || "";
  return t.replace(/\{nombre\}/gi, primer).replace(/\{asesor\}/gi, v.asesor).replace(/\s+([,.!?])/g, "$1").replace(/ {2,}/g, " ").trim();
}
const etapaConv = (c: Conv) => etapaDe({ pedidoEstado: c.pedidoEstado, etiquetas: c.etiquetas });
function prefijo(c: Conv) {
  if (c.ultimoEmisor === "ia") return "Neo AI: ";
  if (c.ultimoEmisor === "asesor_panel" || c.ultimoEmisor === "asesor_uchat") return "Equipo: ";
  return "";
}

function useVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const f = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return v;
}

function Avatar({ c, grande = false }: { c: Conv; grande?: boolean }) {
  const humano = tomado(c);
  return (
    <span className={`lc-av ${grande ? "xl" : ""}`}>
      <span className="lc-av-in" style={{ background: tono(c.userNs || c.id) }}>{iniciales(c.nombre || c.telefono)}</span>
      {!grande ? (
        <span className={`lc-av-quien ${humano ? "humano" : ""}`} title={humano ? "La atiende el equipo" : "La atiende Neo AI"}>
          {humano ? <UserRound size={10} strokeWidth={3} /> : <Bot size={10} strokeWidth={3} />}
        </span>
      ) : null}
    </span>
  );
}

function EtapaChip({ c, conRef = true }: { c: Conv; conRef?: boolean }) {
  const e = etapaConv(c);
  if (e === "nuevo") return null;
  return (
    <span className={`lc-etapa e-${e}`} title={ETAPAS[e].label}>
      <i />{ETAPAS[e].corto}{conRef && c.pedidoRef && esConfirmado(e) ? <b>{c.pedidoRef}</b> : null}
    </span>
  );
}

/* ================================================================== */

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
  const [cont, setCont] = useState<Contadores | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorSync, setErrorSync] = useState("");
  const [actualizando, setActualizando] = useState(false);
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
      if (j.ok) { setLista(j.conversaciones); setCont(j.contadores || null); setResumen(j.resumen || null); setErrorSync(j.error || ""); }
      else setErrorSync(j.error || "Error leyendo la bandeja");
    } catch { setErrorSync("Sin conexión"); }
    setCargandoLista(false);
  }, [espacio, filtro, q]);

  useEffect(() => {
    setCargandoLista(true);
    const t = setTimeout(() => cargarLista({ sync: false }).then(() => cargarLista()), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [cargarLista, q]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => cargarLista(), 15000);
    return () => clearInterval(t);
  }, [visible, cargarLista]);
  useEffect(() => {
    const n = cont?.sin_leer || 0;
    document.title = n ? `(${n}) Live Chat · Animals Deluxe` : "Live Chat · Animals Deluxe";
  }, [cont?.sin_leer]);

  const convSel = lista.find((c) => c.id === sel) || null;
  const chips: [Filtro, string][] = [
    ["todos", "Todos"], ["sin_leer", "Sin responder"], ["confirmados", "Con pedido"], ["asesor", "Piden asesor"],
    ["humano", esp.conIa ? "Equipo" : "Atendidos"],
    rol === "admin" ? ["sin_asignar", "Sin asignar"] : ["mios", "Míos"],
  ];

  return (
    <div className={`lc ${sel ? "con-hilo" : ""}`}>
      <aside className="lc-lista">
        <div className="lc-cab">
          <span className="lc-cab-neo"><CaraNeo tamano={44} /></span>
          <div className="lc-cab-txt">
            <span className="lc-ante">WhatsApp · {esp.conIa ? "Neo AI" : "asesores"}</span>
            <h1>Live Chat</h1>
          </div>
          <div className="lc-cab-acc">
            <button className="lc-ico" title="Actualizar desde UChat" disabled={actualizando}
              onClick={async () => { setActualizando(true); await cargarLista({ forzar: true }); setActualizando(false); }}>
              <RefreshCw size={16} className={actualizando ? "lc-gira" : ""} />
            </button>
            {rol === "admin" ? <button className="lc-ico" title="Ajustes del Live Chat" onClick={() => setAjustes(true)}><Settings size={16} /></button> : null}
          </div>
        </div>

        {espacios.length > 1 ? (
          <div className="lc-espacios" role="tablist">
            {espacios.map((e) => (
              <button key={e.codigo} role="tab" aria-selected={e.codigo === espacio} className={e.codigo === espacio ? "on" : ""} onClick={() => { setEspacio(e.codigo); setSel(null); }}>
                {e.conIa ? <Bot size={14} /> : <UserRound size={14} />} {e.nombre}
              </button>
            ))}
          </div>
        ) : null}

        {resumen ? (
          <div className="lc-hoy" aria-label="Resumen de hoy">
            <div className="lc-hoy-cab"><span>Hoy</span><EnVivo texto={esp.conIa ? "Neo AI atendiendo" : "en vivo"} /></div>
            <div className="lc-hoy-grid">
              <div><b>{resumen.chats}</b><span>chats</span></div>
              <div><b>{resumen.pedidos}</b><span>pedidos</span></div>
              <button className={resumen.sinResponder ? "alerta" : ""} onClick={() => setFiltro("sin_leer")}><b>{resumen.sinResponder}</b><span>sin responder</span></button>
              <button className={resumen.pidenAsesor ? "alerta" : ""} onClick={() => setFiltro("asesor")}><b>{resumen.pidenAsesor}</b><span>piden asesor</span></button>
            </div>
          </div>
        ) : null}

        <div className="lc-lista-ctrl">
          <label className="lc-buscar">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, celular o texto" aria-label="Buscar conversaciones" />
            {q ? <button className="lc-x" onClick={() => setQ("")} aria-label="Limpiar"><X size={14} /></button> : <kbd>{cont?.todos ?? 0}</kbd>}
          </label>
          <div className="lc-filtros" role="tablist" aria-label="Filtrar conversaciones">
            {chips.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={filtro === k} className={`lc-chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>
                {l}{cont && k !== "todos" ? <i className={(k === "sin_leer" || k === "asesor") && cont[k] > 0 && filtro !== k ? "alerta" : ""}>{cont[k]}</i> : null}
              </button>
            ))}
          </div>
          {errorSync ? <p className="lc-error" title={errorSync}>{errorSync}</p> : null}
        </div>

        <ul className="lc-items" aria-label="Conversaciones">
          {cargandoLista && !lista.length ? Array.from({ length: 7 }, (_, i) => <li key={i} className="lc-sk"><span /><span /></li>) : null}
          {!cargandoLista && !lista.length ? (
            <li className="lc-vacio"><CaraNeo tamano={36} /><b>{q ? "Nada coincide" : "Nada con ese filtro"}</b><span>{q ? "Prueba con otra búsqueda." : "Prueba con otro filtro."}</span></li>
          ) : null}
          {lista.map((c) => {
            const activa = c.id === sel;
            const pide = pidioAsesor(c.etiquetas) && !tomado(c) && !esConfirmado(etapaConv(c));
            return (
              <li key={c.id}>
                <button className={`lc-item ${activa ? "on" : ""} ${c.sinLeer ? "nuevo" : ""}`} onClick={() => setSel(c.id)} aria-current={activa ? "true" : undefined}>
                  <Avatar c={c} />
                  <span className="lc-item-cuerpo">
                    <span className="lc-item-fila">
                      <b>{c.nombre || telLegible(c.telefono) || "Sin nombre"}</b>
                      <time>{hace(c.ultimoAt)}</time>
                    </span>
                    <span className="lc-item-fila">
                      <span className="lc-prev"><span>{prefijo(c)}</span>{c.ultimoTexto || (c.mensajesSyncAt ? "Sin mensajes en UChat" : "Se descarga al abrir")}</span>
                      {pide ? <Hand size={14} className="lc-pide" aria-label="Pidió un asesor" /> : null}
                      {c.sinLeer > 0 ? <span className="lc-badge" title="Mensajes sin responder">{c.sinLeer}</span> : null}
                    </span>
                    <span className="lc-item-tags">
                      <span className="lc-mono">{tomado(c) ? "Equipo" : <><i className="lc-punto" />Neo AI</>} · {c.canal === "whatsapp" ? "WhatsApp" : c.canal}</span>
                      <EtapaChip c={c} />
                      {c.asesorId ? <span className="lc-tag">{nombreAsesor[c.asesorId] || "Asesor"}</span> : null}
                      {!ventana(c) ? <span className="lc-tag urgente">24 h cerrada</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {convSel ? (
        <Hilo key={convSel.id} conv={convSel} esp={esp} rol={rol} yo={yo} asesores={asesores} respuestas={respuestas}
          productos={productos} visible={visible} onVolver={() => setSel(null)} onCambio={() => cargarLista({ sync: false })} />
      ) : (
        <section className="lc-hilo lc-hilo-vacio">
          <div className="lc-bienv">
            <span className="lc-bienv-neo"><img src="/brand/neo/neo-logo.webp" alt="Neo AI" width={360} height={300} /></span>
            <h2>Elige una conversación</h2>
            <p>{esp.conIa ? "Neo AI atiende solo. Tú entras cuando quieras: tomas el chat y respondes." : "Chats de la línea de asesores, repartidos de forma equitativa."}</p>
            <div className="lc-bienv-neo-card">
              <CaraNeo tamano={30} />
              <div>
                <span className="lc-ante">Neo AI</span>
                <b>Atendiendo tus chats de WhatsApp</b>
              </div>
              <EnVivo texto="" />
            </div>
            <ul className="lc-leyenda">
              <li><span className="lc-etapa e-confirmado"><i />Confirmado</span> ya hizo el pedido</li>
              <li><span className="lc-etapa e-datos"><i />Datos</span> está dando sus datos</li>
              <li><span className="lc-etapa e-interesado"><i />Interesado</span> vio un producto</li>
              <li><span className="lc-tag vigilar"><Hand size={11} /> Pide asesor</span> quiere hablar con una persona</li>
            </ul>
            <PoweredNeo />
          </div>
        </section>
      )}

      {ajustes ? <Ajustes asesores={asesores} respuestas={respuestas} setRespuestas={setRespuestas} onCerrar={() => setAjustes(false)} /> : null}
    </div>
  );
}

/* ================================================================== */

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
  // true mientras se trae el hilo de UChat por primera vez en esta apertura.
  const [trayendo, setTrayendo] = useState(true);
  const [texto, setTexto] = useState("");
  const [modoNota, setModoNota] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "err"; t: string } | null>(null);
  const [panel, setPanel] = useState<"" | "producto" | "imagen" | "plantilla" | "respuestas">("");
  const [verFicha, setVerFicha] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const ultimoId = useRef("");

  const cargar = useCallback(async (sync = true) => {
    try {
      const r = await fetch(`/api/livechat/hilo?id=${conv.id}${sync ? "" : "&sync=0"}`, { cache: "no-store" });
      const j = await r.json();
      if (j.ok) { setMensajes(j.mensajes); setConv(j.conversacion); setCliente(j.cliente); setPedidos(j.pedidos || []); }
      else setAviso({ tipo: "err", t: j.error });
    } catch { /* reintenta en el siguiente ciclo */ }
    setCargando(false);
  }, [conv.id]);

  // Primero lo guardado (instantáneo), luego lo nuevo de UChat. Mientras llega,
  // un chat que nunca se descargó muestra «Trayendo…» en vez de «sin mensajes».
  useEffect(() => {
    setTrayendo(true);
    cargar(false).then(() => cargar()).finally(() => setTrayendo(false));
  }, [cargar]);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => cargar(), esp.conIa ? 4000 : 10000);
    return () => clearInterval(t);
  }, [visible, cargar, esp.conIa]);
  useEffect(() => {
    const u = mensajes[mensajes.length - 1]?.id || "";
    if (u !== ultimoId.current) { ultimoId.current = u; finRef.current?.scrollIntoView({ block: "end" }); }
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
  const etapa = etapaConv(conv);
  const confirmado = esConfirmado(etapa);
  const pideAsesor = pidioAsesor(conv.etiquetas);
  const sugerencias = texto.startsWith("/") && !texto.includes(" ")
    ? respuestas.filter((r) => r.atajo.startsWith(texto.slice(1).toLowerCase())).slice(0, 6) : [];
  const usar = (t: string) => { setTexto(rellenar(t, { nombre: conv.nombre, asesor: yo.nombre })); setPanel(""); areaRef.current?.focus(); };
  const ultimoPedido = pedidos.find((p) => p.estado !== "cancelado");
  const ultimo = mensajes[mensajes.length - 1];
  // «Neo AI está escribiendo…»: el cliente escribió hace menos de 90 s, Neo está activo y aún no contesta.
  const neoEscribe = esp.conIa && !esTomado && ultimo?.emisor === "cliente" && Date.now() - new Date(ultimo.providerTs).getTime() < 90_000;

  async function enviar() {
    const t = texto.trim();
    if (!t || ocupado) return;
    const ok = modoNota ? await correr(() => notaInterna(conv.id, t), "Nota guardada") : await correr(() => enviarMensaje(conv.id, t));
    if (ok) setTexto("");
  }

  // Agrupa por día y, dentro, por remitente consecutivo (la firma va solo en el primero).
  const bloques: { dia: string; items: { m: Msg; primero: boolean }[] }[] = [];
  let anterior = "";
  for (const m of mensajes) {
    const d = dia(m.providerTs);
    if (!bloques.length || bloques[bloques.length - 1].dia !== d) { bloques.push({ dia: d, items: [] }); anterior = ""; }
    const clave = m.direccion === "event" ? "" : `${m.emisor}:${m.autor}`;
    bloques[bloques.length - 1].items.push({ m, primero: clave !== anterior });
    anterior = clave;
  }

  return (
    <>
      <section className="lc-hilo">
        <header className="lc-hilo-top">
          <button className="lc-ico lc-solo-movil" onClick={onVolver} aria-label="Volver a la lista"><ArrowLeft size={18} /></button>
          <Avatar c={conv} />
          <div className="lc-hilo-quien">
            <div className="lc-hilo-nombre"><b title={conv.nombre}>{conv.nombre || telLegible(conv.telefono) || "Sin nombre"}</b><EtapaChip c={conv} /></div>
            <p>
              <i className={`lc-latido ${esTomado || !esp.conIa ? "equipo" : ""}`} aria-hidden />
              {esp.conIa ? (esTomado
                ? <>Atiende <b>el equipo</b>{conv.botPausadoHasta ? ` · Neo vuelve ${hora(conv.botPausadoHasta)}` : ""}</>
                : <>Atiende <b className="neo">Neo AI</b></>) : <>Línea de asesores</>}
              <span className="lc-sep">·</span>{telLegible(conv.telefono)}
              {!abierta ? <><span className="lc-sep">·</span><span className="lc-cerr">24 h cerrada</span></> : null}
            </p>
          </div>
          <div className="lc-hilo-acc">
            {esp.conIa ? (
              esTomado
                ? <button className="lc-btn soft" disabled={ocupado} onClick={() => correr(() => devolverAlBot(conv.id), "Neo AI vuelve a responder")}><Bot size={15} /> <span>Devolver a Neo AI</span></button>
                : <button className="lc-btn" disabled={ocupado} onClick={() => correr(() => tomarChat(conv.id), "Chat tomado: Neo AI queda en pausa")}><UserRound size={15} /> <span>Tomar</span></button>
            ) : null}
            <button className="lc-ico" title="Traer de UChat ahora" disabled={ocupado} onClick={() => correr(() => refrescarHilo(conv.id))}><RefreshCw size={15} /></button>
            <button className={`lc-ico lc-solo-estrecho ${verFicha ? "on" : ""}`} title="Ficha del cliente" aria-label="Ver ficha del cliente" onClick={() => setVerFicha((v) => !v)}><PanelRight size={16} /></button>
          </div>
        </header>

        {confirmado && (ultimoPedido || conv.pedidoId) ? (
          <a className="lc-banda ok" href={`/pedidos/${ultimoPedido?.id || conv.pedidoId}`}>
            <span className="lc-banda-ico"><Check size={14} strokeWidth={3} /></span>
            <span className="lc-banda-txt"><b>{ETAPAS[etapa].label}</b> · {ultimoPedido?.ref || conv.pedidoRef} · {cop(ultimoPedido?.totalCop ?? conv.pedidoTotal)}
              {ultimoPedido?.items.length ? <> · {ultimoPedido.items.join(", ")}</> : null}
              {conv.pedidosNum > 1 ? <> · {conv.pedidosNum} pedidos</> : null}</span>
            <em>Ver pedido <ExternalLink size={13} /></em>
          </a>
        ) : confirmado && !cargando ? (
          <div className="lc-banda ok"><span className="lc-banda-ico"><Check size={14} strokeWidth={3} /></span>
            <span className="lc-banda-txt"><b>Neo AI marcó «Pedido creado»</b> · no se encontró el pedido por teléfono; búscalo en Pedidos.</span></div>
        ) : pideAsesor && !esTomado && esp.conIa ? (
          <div className="lc-banda vigilar">
            <span className="lc-banda-ico"><Hand size={14} /></span>
            <span className="lc-banda-txt"><b>Pidió hablar con un asesor.</b> Neo AI sigue respondiendo hasta que alguien tome el chat.</span>
            <button className="lc-btn" disabled={ocupado} onClick={() => correr(() => tomarChat(conv.id), "Chat tomado")}>Atender ahora</button>
          </div>
        ) : null}

        <div className="lc-msgs">
          {(cargando || trayendo) && !mensajes.length ? (
            <div className="lc-msgs-trayendo" role="status">
              <p><CaraNeo tamano={16} /> Trayendo la conversación de UChat…</p>
              <div className="lc-msgs-sk" aria-hidden>{["i 56", "d 72", "d 40", "i 48", "d 64"].map((x, i) => <span key={i} className={x[0] === "i" ? "izq" : "der"} style={{ width: `${x.slice(2)}%` }} />)}</div>
            </div>
          ) : null}
          {!cargando && !trayendo && !mensajes.length ? (
            <div className="lc-msgs-vacio">
              <b>UChat no tiene mensajes de este chat</b>
              <p>El contacto existe (entró por un anuncio o un comentario) pero no hay historial de WhatsApp guardado en UChat.</p>
              <button className="lc-btn soft" disabled={ocupado} onClick={() => correr(() => refrescarHilo(conv.id), "Actualizado")}><RefreshCw size={14} /> Volver a intentar</button>
            </div>
          ) : null}
          {bloques.map((b) => (
            <section key={b.dia} aria-label={b.dia}>
              <p className="lc-dia"><span>{b.dia}</span></p>
              {b.items.map(({ m, primero }) => <Burbuja key={m.id} m={m} primero={primero} onFoto={setFoto} />)}
            </section>
          ))}
          {neoEscribe ? <NeoEscribiendo /> : null}
          <div ref={finRef} />
        </div>

        {aviso ? <div className={`lc-aviso ${aviso.tipo}`}>{aviso.tipo === "ok" ? <Check size={14} /> : null}{aviso.t}</div> : null}

        {panel === "producto" ? <PanelProducto productos={productos} onCerrar={() => setPanel("")} onElegir={async (p) => { if (await correr(() => enviarProducto(conv.id, p.id), `${p.nombre} enviado`)) setPanel(""); }} /> : null}
        {panel === "imagen" ? <PanelImagen onCerrar={() => setPanel("")} onEnviar={async (u, pie) => { if (await correr(() => enviarImagen(conv.id, u, pie), "Imagen enviada")) setPanel(""); }} /> : null}
        {panel === "plantilla" ? <PanelPlantilla convId={conv.id} nombre={conv.nombre} onCerrar={() => setPanel("")} onEnviar={async (n, v) => { if (await correr(() => enviarPlantilla(conv.id, n, v), "Plantilla enviada")) setPanel(""); }} /> : null}
        {panel === "respuestas" ? (
          <div className="lc-panel">
            <div className="lc-panel-top"><b>Respuestas rápidas</b><button className="lc-ico" onClick={() => setPanel("")} aria-label="Cerrar"><X size={15} /></button></div>
            <div className="lc-opciones">
              {respuestas.map((r) => <button key={r.id} onClick={() => usar(r.texto)}><b>/{r.atajo}</b><span>{rellenar(r.texto, { nombre: conv.nombre, asesor: yo.nombre })}</span></button>)}
              {!respuestas.length ? <p className="lc-mut">Aún no hay respuestas rápidas. Créalas en Ajustes.</p> : null}
            </div>
          </div>
        ) : null}

        <footer className="lc-comp">
          {!abierta && !modoNota ? (
            <div className="lc-cerrada">
              <span className="lc-cerrada-ico"><FileText size={16} /></span>
              <p><b>Ventana de 24 h cerrada.</b> WhatsApp solo deja escribirle con una plantilla aprobada.</p>
              <button className="lc-btn" onClick={() => setPanel("plantilla")}>Enviar plantilla</button>
              <button className="lc-btn soft" onClick={() => setModoNota(true)}>Nota interna</button>
            </div>
          ) : (
            <>
              <div className="lc-comp-barra">
                <div className="lc-seg" role="tablist" aria-label="Tipo de mensaje">
                  <button role="tab" aria-selected={!modoNota} className={!modoNota ? "on" : ""} onClick={() => setModoNota(false)}><Send size={13} /> Responder</button>
                  <button role="tab" aria-selected={modoNota} className={modoNota ? "on nota" : ""} onClick={() => setModoNota(true)}><StickyNote size={13} /> Nota interna</button>
                </div>
                {!modoNota ? (
                  <div className="lc-herr">
                    <button className={panel === "respuestas" ? "on" : ""} onClick={() => setPanel(panel === "respuestas" ? "" : "respuestas")} title="Respuestas rápidas" aria-label="Respuestas rápidas"><Zap size={16} /></button>
                    <button className={panel === "producto" ? "on" : ""} onClick={() => setPanel(panel === "producto" ? "" : "producto")} title="Enviar producto" aria-label="Enviar producto"><Package size={16} /></button>
                    <button className={panel === "imagen" ? "on" : ""} onClick={() => setPanel(panel === "imagen" ? "" : "imagen")} title="Enviar imagen" aria-label="Enviar imagen"><ImageIcon size={16} /></button>
                    <button className={panel === "plantilla" ? "on" : ""} onClick={() => setPanel(panel === "plantilla" ? "" : "plantilla")} title="Plantilla de WhatsApp" aria-label="Plantilla de WhatsApp"><FileText size={16} /></button>
                  </div>
                ) : null}
                <span className="lc-pista">{modoNota ? "Solo la ve el equipo" : esp.conIa && !esTomado ? "Al enviar, tomas el chat y Neo AI se pausa" : ""}</span>
              </div>
              {sugerencias.length ? (
                <div className="lc-sug">
                  {sugerencias.map((r) => <button key={r.id} onClick={() => usar(r.texto)}><b>/{r.atajo}</b> <span>{r.texto}</span></button>)}
                </div>
              ) : null}
              <form className={`lc-caja ${modoNota ? "nota" : ""}`} onSubmit={(e) => { e.preventDefault(); enviar(); }}>
                <textarea
                  ref={areaRef}
                  value={texto}
                  rows={1}
                  aria-label={modoNota ? "Nota interna" : "Mensaje"}
                  placeholder={modoNota ? "Escribe una nota para el equipo…" : "Escribe un mensaje…  ( / para respuestas rápidas )"}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (sugerencias.length && texto.startsWith("/")) usar(sugerencias[0].texto);
                      else enviar();
                    }
                  }}
                />
                <button type="submit" className="lc-enviar" disabled={ocupado || !texto.trim()} aria-label={modoNota ? "Guardar nota" : "Enviar"}>
                  {modoNota ? <StickyNote size={17} /> : <Send size={17} />}
                </button>
              </form>
            </>
          )}
        </footer>
      </section>

      <Ficha conv={conv} esp={esp} rol={rol} asesores={asesores} cliente={cliente} pedidos={pedidos} abierta={verFicha}
        ocupado={ocupado} onCerrar={() => setVerFicha(false)} onAsignar={(id) => correr(() => asignarAsesor(conv.id, id), "Asignado")} />

      {foto ? (
        <div className="lc-visor" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setFoto(null)}>
          <img src={foto} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="lc-visor-x" onClick={() => setFoto(null)} aria-label="Cerrar"><X size={20} /></button>
        </div>
      ) : null}
    </>
  );
}

/* ================================================================== */

function Ficha({ conv, esp, rol, asesores, cliente, pedidos, abierta, ocupado, onCerrar, onAsignar }: {
  conv: Conv; esp: EspacioUI; rol: "admin" | "asesor"; asesores: Asesor[]; cliente: Cliente; pedidos: Pedido[];
  abierta: boolean; ocupado: boolean; onCerrar: () => void; onAsignar: (id: string | null) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const etapa = etapaConv(conv);
  const paso = PASOS.indexOf(etapa);
  const tags = Array.isArray(cliente?.tags) ? (cliente!.tags as string[]) : [];
  return (
    <aside className={`lc-ficha ${abierta ? "abierta" : ""}`} aria-label="Ficha del cliente">
      <button className="lc-ico lc-ficha-x lc-solo-estrecho" onClick={onCerrar} aria-label="Cerrar ficha"><X size={16} /></button>
      <div className="lc-ficha-cab">
        <Avatar c={conv} grande />
        <b>{conv.nombre || "Sin nombre"}</b>
        {conv.telefono ? (
          <div className="lc-ficha-tel">
            <span>{telLegible(conv.telefono)}</span>
            <button className="lc-ico mini" title="Copiar número" aria-label="Copiar número" onClick={() => { navigator.clipboard?.writeText(conv.telefono); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>
              {copiado ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <a className="lc-ico mini" title="Abrir en WhatsApp" aria-label="Abrir en WhatsApp" href={`https://wa.me/${conv.telefono}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
          </div>
        ) : null}
        <EtapaChip c={conv} />
      </div>

      <section className="lc-sec">
        <h5>Etapa de venta</h5>
        <ol className="lc-pasos">
          {PASOS.map((p, i) => <li key={p} className={`${i <= paso ? "hecho" : ""} ${i === paso ? "actual" : ""}`} title={ETAPAS[p].label}><span /></li>)}
        </ol>
        <p className="lc-paso-actual"><b>{ETAPAS[etapa].label}</b><span>{paso + 1} de {PASOS.length}</span></p>
      </section>

      <section className="lc-sec">
        <h5>Pedidos {pedidos.length ? <i>{pedidos.length}</i> : null}</h5>
        {pedidos.length ? pedidos.map((p) => {
          const est = ESTADO_PEDIDO[p.estado || ""] || { label: p.estado || "—", tono: "neutro" };
          return (
            <a key={p.id} className="lc-pedido" href={`/pedidos/${p.id}`}>
              <div className="lc-pedido-fila"><b>{p.ref}</b><span className={`lc-tag ${est.tono}`}>{est.label}</span></div>
              {p.items.length ? <div className="lc-pedido-items">{p.items.join(" · ")}</div> : null}
              <div className="lc-pedido-fila"><span className="lc-mut">{fecha(p.createdAt)}{p.ciudad ? ` · ${p.ciudad}` : ""}</span><b className="lc-total">{cop(p.totalCop)}</b></div>
              {p.guia ? <div className="lc-mut">{p.transportadora || "Guía"} {p.guia}</div> : null}
            </a>
          );
        }) : <p className="lc-mut">Sin pedidos con este cliente o teléfono.</p>}
      </section>

      <section className="lc-sec">
        <h5>Conversación</h5>
        <dl>
          <dt>Ventana 24 h</dt><dd>{ventana(conv) ? <span className="lc-tag ok">Abierta</span> : <span className="lc-tag urgente">Cerrada</span>}</dd>
          {esp.conIa ? <><dt>Responde</dt><dd>{tomado(conv) ? "El equipo" : <span className="lc-neo-txt"><CaraNeo tamano={14} />Neo AI</span>}</dd></> : null}
          <dt>Asesor</dt>
          <dd>
            {rol === "admin" ? (
              <select value={conv.asesorId || ""} disabled={ocupado} onChange={(e) => onAsignar(e.target.value || null)} aria-label="Asignar asesor">
                <option value="">Sin asignar</option>
                {asesores.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            ) : asesores.find((a) => a.id === conv.asesorId)?.nombre || "Sin asignar"}
          </dd>
          <dt>Canal</dt><dd>{conv.canal === "whatsapp" ? "WhatsApp" : conv.canal}</dd>
        </dl>
        {conv.etiquetas.length ? <div className="lc-tags">{conv.etiquetas.map((t) => <span key={t}>{t}</span>)}</div> : null}
      </section>

      <section className="lc-sec">
        <h5>Cliente</h5>
        {cliente ? (
          <dl>
            <dt>Ciudad</dt><dd>{[cliente.ciudad, cliente.departamento].filter(Boolean).join(", ") || "—"}</dd>
            {cliente.direccion ? <><dt>Dirección</dt><dd>{cliente.direccion}</dd></> : null}
            <dt>Estado</dt><dd>{cliente.estado || "—"}</dd>
            <dt>Compras</dt><dd>{cliente.numPedidos || 0} · {cop(cliente.totalGastado)}</dd>
            {cliente.ultimoProductoVisto ? <><dt>Vio</dt><dd>{cliente.ultimoProductoVisto}</dd></> : null}
            {cliente.notas ? <><dt>Notas</dt><dd>{cliente.notas}</dd></> : null}
          </dl>
        ) : <p className="lc-mut">Aún no está en el CRM: se crea cuando Neo AI lo registra o hace un pedido.</p>}
        {tags.length ? <div className="lc-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div> : null}
      </section>
      <div className="lc-ficha-pie"><PoweredNeo /><span className="lc-mono">UChat · {conv.userNs}</span></div>
    </aside>
  );
}

function Burbuja({ m, primero, onFoto }: { m: Msg; primero: boolean; onFoto: (url: string) => void }) {
  if (m.emisor === "sistema") return <p className="lc-evento"><span>{m.texto}<time>{hora(m.providerTs)}</time></span></p>;
  if (m.emisor === "nota") {
    return (
      <div className="lc-notai">
        <p className="lc-notai-cab"><StickyNote size={13} /> Nota interna · {m.autor || "equipo"}<time>{hora(m.providerTs)}</time></p>
        <p>{m.texto}</p>
      </div>
    );
  }
  const delCliente = m.emisor === "cliente";
  const pendiente = m.providerMsgId.startsWith("panel:");
  const soloFoto = m.tipo === "image" && !m.texto && !!m.mediaUrl;
  return (
    <div className={`lc-fila ${delCliente ? "izq" : "der"} ${primero ? "primero" : ""}`}>
      {primero && !delCliente ? (
        <span className={`lc-quien ${m.emisor === "ia" ? "es-neo" : ""}`}>
          {m.emisor === "ia" ? <><span className="lc-quien-neo"><CaraNeo tamano={18} /></span>Neo AI</> : <><UserRound size={12} />{m.autor || "Equipo"}</>}
        </span>
      ) : null}
      <div className={`lc-b ${m.emisor} ${soloFoto ? "foto" : ""} ${pendiente ? "pend" : ""}`}>
        {m.tipo === "image" && m.mediaUrl ? <button className="lc-foto" onClick={() => onFoto(m.mediaUrl)} aria-label="Ampliar la foto"><img src={m.mediaUrl} alt="" loading="lazy" /></button> : null}
        {m.tipo === "video" && m.mediaUrl ? <video src={m.mediaUrl} controls preload="metadata" /> : null}
        {m.tipo === "audio" && m.mediaUrl ? <audio src={m.mediaUrl} controls preload="none" /> : null}
        {m.tipo === "file" && m.mediaUrl ? <a className="lc-archivo" href={m.mediaUrl} target="_blank" rel="noreferrer"><FileText size={16} /> Abrir archivo</a> : null}
        {m.texto ? <p>{m.tipo === "audio" ? <><small className="lc-transc">Transcripción</small>{m.texto}</> : m.texto}</p> : null}
        <time>{pendiente ? "enviando…" : hora(m.providerTs)}</time>
      </div>
    </div>
  );
}

function PanelProducto({ productos, onElegir, onCerrar }: { productos: Producto[]; onElegir: (p: Producto) => void; onCerrar: () => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const lista = productos.filter((p) => !t || p.nombre.toLowerCase().includes(t)).slice(0, 60);
  return (
    <div className="lc-panel">
      <div className="lc-panel-top"><b>Enviar producto</b><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" /><button className="lc-ico" onClick={onCerrar} aria-label="Cerrar"><X size={15} /></button></div>
      <p className="lc-mut lc-panel-nota">Se envía la foto y la ficha con precio y forma de pago.</p>
      <div className="lc-prods">
        {lista.map((p) => (
          <button key={p.id} onClick={() => onElegir(p)}>
            {p.imagen ? <img src={p.imagen} alt="" loading="lazy" /> : <span className="lc-noimg"><Package size={22} /></span>}
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
      <div className="lc-panel-top"><b>Enviar imagen</b><button className="lc-ico" onClick={onCerrar} aria-label="Cerrar"><X size={15} /></button></div>
      <div className="lc-form">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (enlace público de la imagen)" aria-label="Enlace de la imagen" />
        {/^https:\/\/\S+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url) ? <img className="lc-prev-img" src={url} alt="" /> : null}
        <input value={pie} onChange={(e) => setPie(e.target.value)} placeholder="Texto que va después (opcional)" aria-label="Texto" />
        <button className="lc-btn" disabled={!/^https:\/\//.test(url)} onClick={() => onEnviar(url, pie)}><Send size={14} /> Enviar imagen</button>
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
      <div className="lc-panel-top"><b>Plantillas de WhatsApp</b><button className="lc-ico" onClick={onCerrar} aria-label="Cerrar"><X size={15} /></button></div>
      {err ? <p className="lc-error lc-panel-nota">{err}</p> : null}
      {!lista && !err ? <p className="lc-mut lc-panel-nota">Cargando plantillas de UChat…</p> : null}
      {lista && !elegida ? (
        <div className="lc-opciones">
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
          {vals.map((v, i) => <input key={i} value={v} placeholder={`Variable {{${i + 1}}}`} aria-label={`Variable ${i + 1}`} onChange={(e) => setVals(vals.map((x, j) => (j === i ? e.target.value : x)))} />)}
          <div className="lc-fila-btns">
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
      <div className="lc-modal" role="dialog" aria-modal="true" aria-label="Ajustes del Live Chat" onClick={(e) => e.stopPropagation()}>
        <div className="lc-panel-top"><b>Ajustes del Live Chat</b><button className="lc-ico" onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button></div>
        {msg ? <div className="lc-aviso ok estatico"><Check size={14} /> {msg}</div> : null}
        <h5>Asesores</h5>
        <p className="lc-mut">El correo es con el que el asesor entra al panel: verá solo sus chats de la línea de asesores. «Recibe chats» lo incluye en el reparto equitativo.</p>
        <div className="lc-ases">
          {asesores.map((a) => (
            <div key={a.id} className="lc-ases-fila">
              <b>{a.nombre}</b>
              <input value={cfg[a.id]?.email || ""} placeholder="correo@…" aria-label={`Correo de ${a.nombre}`} onChange={(e) => setCfg({ ...cfg, [a.id]: { ...cfg[a.id], email: e.target.value } })} />
              <label><input type="checkbox" checked={!!cfg[a.id]?.recibe} onChange={(e) => setCfg({ ...cfg, [a.id]: { ...cfg[a.id], recibe: e.target.checked } })} /> Recibe chats</label>
              <button className="lc-btn soft" onClick={async () => { const r = await configurarAsesor(a.id, cfg[a.id].email, cfg[a.id].recibe); setMsg(r.ok ? `${a.nombre} guardado` : r.error); }}>Guardar</button>
            </div>
          ))}
          {!asesores.length ? <p className="lc-mut">Crea asesores en la sección Asesores.</p> : null}
        </div>
        <h5>Respuestas rápidas</h5>
        <p className="lc-mut">Se usan escribiendo «/atajo» en el chat o con el botón ⚡. Puedes usar {"{nombre}"} y {"{asesor}"}.</p>
        <div className="lc-rr">
          {respuestas.map((r) => (
            <div key={r.id} className="lc-rr-fila">
              <b>/{r.atajo}</b><span>{r.texto}</span>
              <button className="lc-ico" title="Borrar" aria-label={`Borrar /${r.atajo}`} onClick={async () => { const x = await borrarRespuestaRapida(r.id); if (x.ok) setRespuestas(respuestas.filter((y) => y.id !== r.id)); else setMsg(x.error); }}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="lc-form">
          <input value={atajo} onChange={(e) => setAtajo(e.target.value)} placeholder="atajo (ej. envio)" aria-label="Atajo" />
          <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Texto de la respuesta" rows={3} aria-label="Texto de la respuesta" />
          <button className="lc-btn" disabled={!atajo.trim() || !txt.trim()} onClick={guardarR}>Guardar respuesta</button>
        </div>
      </div>
    </div>
  );
}

"use client";

/* Live Chat · bandeja (lista + hilo + ficha). Sondeo: lista cada 15 s, hilo
   abierto cada 4 s (línea IA) o 10 s (sin IA); se pausa con la pestaña oculta.
   Todo permiso se valida en el servidor; aquí solo se esconde lo que no aplica.
   Etapa de venta (etiqueta): pedido real de la plataforma + etiquetas del bot. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Check, Copy, ExternalLink, FileText, Image as ImageIcon, Info, Package,
  RefreshCw, Search, Send, Settings, StickyNote, UserRound, X, Zap,
} from "lucide-react";
import {
  asignarAsesor, borrarRespuestaRapida, configurarAsesor, devolverAlBot, enviarImagen, enviarMensaje, enviarPlantilla,
  enviarProducto, guardarRespuestaRapida, notaInterna, plantillasDe, refrescarHilo, tomarChat, type Res,
} from "./acciones";
import { ETAPAS, esConfirmado, etapaDe, pidioAsesor, type Etapa } from "@/lib/livechat/puro";
import { CaraNeo, EnVivo, FirmaNeo, NeoEscribiendo, PoweredNeo } from "@/components/neo";

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
  pedidoAt: string | null; pedidosNum: number;
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

const cop = (n: number | null | undefined) => "$" + new Intl.NumberFormat("es-CO").format(n || 0);
const VENTANA_MS = 24 * 3600 * 1000;
const ESTADO_PEDIDO: Record<string, { label: string; tono: string }> = {
  remision: { label: "En remisión", tono: "verde" },
  por_revisar: { label: "Por revisar", tono: "ambar" },
  aprobado: { label: "Aprobado", tono: "teal" },
  guia: { label: "Con guía", tono: "azul" },
  despachado: { label: "Despachado", tono: "azul" },
  entregado: { label: "Entregado", tono: "azul" },
  cancelado: { label: "Cancelado", tono: "rojo" },
};
const ETAPA_ICO: Record<Etapa, string> = { despachado: "🚚", aprobado: "✔️", confirmado: "✅", datos: "📝", interesado: "👀", nuevo: "" };
const PASOS: Etapa[] = ["nuevo", "interesado", "datos", "confirmado", "aprobado", "despachado"];

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
  return limpio.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "👤";
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
const ICONO_EMISOR: Record<string, string> = { ia: "Neo: ", asesor_uchat: "Equipo: ", asesor_panel: "Equipo: " };

function useVisible() {
  const [v, setV] = useState(true);
  useEffect(() => {
    const f = () => setV(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  return v;
}

function EtapaBadge({ c, compacto = false }: { c: Conv; compacto?: boolean }) {
  const e = etapaConv(c);
  if (e === "nuevo") return null;
  return (
    <span className={`lc-etapa e-${e}`} title={ETAPAS[e].label}>
      {ETAPA_ICO[e]} {compacto ? ETAPAS[e].corto : ETAPAS[e].label}
      {c.pedidoRef && esConfirmado(e) ? <b>{c.pedidoRef}</b> : null}
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
      if (j.ok) { setLista(j.conversaciones); setCont(j.contadores || null); setErrorSync(j.error || ""); }
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
  // Pestaña del navegador con los no leídos.
  useEffect(() => {
    const n = cont?.sin_leer || 0;
    document.title = n ? `(${n}) Live Chat · Animals Deluxe` : "Live Chat · Animals Deluxe";
  }, [cont?.sin_leer]);

  const convSel = lista.find((c) => c.id === sel) || null;
  const chips: [Filtro, string][] = [
    ["todos", "Todos"], ["sin_leer", "Sin responder"], ["confirmados", "✅ Confirmados"], ["asesor", "🙋 Pidieron asesor"],
    ["humano", esp.conIa ? "Tomados" : "Atendidos"],
    rol === "admin" ? ["sin_asignar", "Sin asignar"] : ["mios", "Míos"],
  ];

  return (
    <div className={`lc ${sel ? "con-hilo" : ""}`}>
      <header className="lc-top">
        <div className="lc-top-tit">
          <span className="lc-top-neo"><CaraNeo tamano={26} /></span>
          <div>
            <b>Live Chat</b>
            <small>{esp.conIa ? <EnVivo texto="Neo AI atendiendo WhatsApp" /> : "WhatsApp · asesores"}</small>
          </div>
        </div>
        {espacios.length > 1 ? (
          <div className="lc-tabs">
            {espacios.map((e) => (
              <button key={e.codigo} className={`lc-tab ${e.codigo === espacio ? "on" : ""}`} onClick={() => { setEspacio(e.codigo); setSel(null); }}>
                {e.conIa ? <Bot size={15} /> : <UserRound size={15} />} {e.nombre}
              </button>
            ))}
          </div>
        ) : null}
        <div className="lc-kpis">
          <div className="lc-kpi"><span>Chats</span><b>{cont?.todos ?? "—"}</b></div>
          <div className="lc-kpi k-verde"><span>Sin responder</span><b>{cont?.sin_leer ?? "—"}</b></div>
          <div className="lc-kpi k-ok"><span>Confirmaron</span><b>{cont?.confirmados ?? "—"}</b></div>
          <div className="lc-kpi k-ambar"><span>Piden asesor</span><b>{cont?.asesor ?? "—"}</b></div>
        </div>
        <div className="lc-top-acc">
          <button className="lc-ico" title="Actualizar desde UChat" disabled={actualizando}
            onClick={async () => { setActualizando(true); await cargarLista({ forzar: true }); setActualizando(false); }}>
            <RefreshCw size={16} className={actualizando ? "lc-gira" : ""} />
          </button>
          {rol === "admin" ? <button className="lc-ico" title="Ajustes del Live Chat" onClick={() => setAjustes(true)}><Settings size={16} /></button> : null}
        </div>
      </header>

      <div className="lc-cuerpo">
        <aside className="lc-lista">
          <div className="lc-lista-top">
            <label className="lc-buscar">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, teléfono o mensaje" />
              {q ? <button className="lc-x" onClick={() => setQ("")} title="Limpiar"><X size={14} /></button> : null}
            </label>
            <div className="lc-filtros">
              {chips.map(([k, l]) => (
                <button key={k} className={`lc-chip ${filtro === k ? "on" : ""} ${k === "confirmados" ? "c-ok" : k === "asesor" ? "c-ambar" : ""}`} onClick={() => setFiltro(k)}>
                  {l}{cont && k !== "todos" ? <i>{cont[k]}</i> : null}
                </button>
              ))}
            </div>
            {errorSync ? <div className="lc-error" title={errorSync}>⚠️ {errorSync}</div> : null}
          </div>
          <div className="lc-items">
            {cargandoLista && !lista.length ? Array.from({ length: 6 }, (_, i) => <div key={i} className="lc-sk" />) : null}
            {!cargandoLista && !lista.length ? <div className="lc-vacio">{q ? "Nada coincide con la búsqueda." : "No hay conversaciones en este filtro."}</div> : null}
            {lista.map((c) => {
              const e = etapaConv(c);
              return (
                <button key={c.id} className={`lc-item ${c.id === sel ? "on" : ""} ${c.sinLeer ? "nuevo" : ""}`} onClick={() => setSel(c.id)}>
                  <span className={`lc-av e-${e} ${tomado(c) ? "humano" : ""}`}>{iniciales(c.nombre)}</span>
                  <span className="lc-item-cuerpo">
                    <span className="lc-item-fila">
                      <b>{c.nombre || telLegible(c.telefono) || "Cliente"}</b>
                      <small>{hace(c.ultimoAt)}</small>
                    </span>
                    <span className="lc-item-fila">
                      <span className="lc-prev">{ICONO_EMISOR[c.ultimoEmisor] || ""}{c.ultimoTexto || <i>Cargando mensajes…</i>}</span>
                      {c.sinLeer > 0 ? <span className="lc-badge" title="Mensajes sin responder">{c.sinLeer}</span> : null}
                    </span>
                    <span className="lc-item-tags">
                      <EtapaBadge c={c} compacto />
                      {pidioAsesor(c.etiquetas) && !tomado(c) && !esConfirmado(e) ? <em className="t-ambar">🙋 Pide asesor</em> : null}
                      {esp.conIa && tomado(c) ? <em className="t-hum">Equipo</em> : null}
                      {c.asesorId ? <em>{nombreAsesor[c.asesorId] || "Asesor"}</em> : null}
                      {c.canal && c.canal !== "whatsapp" ? <em>{c.canal}</em> : null}
                      {!ventana(c) ? <em className="t-cerr">24 h cerrada</em> : null}
                    </span>
                  </span>
                </button>
              );
            })}
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
            <div className="lc-bienvenida">
              <div className="lc-bienvenida-ico"><CaraNeo tamano={44} /></div>
              <h4>Elige una conversación</h4>
              <p>{esp.conIa
                ? "Aquí ves en vivo lo que Neo AI habla con cada cliente. Cuando quieras atender tú, toma el chat: Neo queda en pausa."
                : "Chats de la línea de asesores, repartidos de forma equitativa."}</p>
              <ul>
                <li><span className="lc-etapa e-confirmado">✅ Confirmado</span> ya hizo el pedido</li>
                <li><span className="lc-etapa e-datos">📝 Datos</span> está dando sus datos</li>
                <li><span className="lc-etapa e-interesado">👀 Interesado</span> vio un producto</li>
                <li><em className="t-ambar">🙋 Pide asesor</em> quiere hablar con una persona</li>
              </ul>
              <PoweredNeo className="lc-powered-bienv" />
            </div>
          </section>
        )}
      </div>

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
  const [texto, setTexto] = useState("");
  const [modoNota, setModoNota] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "err"; t: string } | null>(null);
  const [panel, setPanel] = useState<"" | "producto" | "imagen" | "plantilla" | "respuestas">("");
  const [verFicha, setVerFicha] = useState(false);
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

  useEffect(() => {
    cargar(false).then(() => cargar());
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

  async function enviar() {
    const t = texto.trim();
    if (!t || ocupado) return;
    const ok = modoNota ? await correr(() => notaInterna(conv.id, t), "Nota guardada") : await correr(() => enviarMensaje(conv.id, t));
    if (ok) setTexto("");
  }

  const bloques: { dia: string; items: Msg[] }[] = [];
  for (const m of mensajes) {
    const d = dia(m.providerTs);
    if (!bloques.length || bloques[bloques.length - 1].dia !== d) bloques.push({ dia: d, items: [] });
    bloques[bloques.length - 1].items.push(m);
  }
  const ultimoPedido = pedidos.find((p) => p.estado !== "cancelado");
  // «Neo AI está escribiendo…»: el cliente escribió hace menos de 90 s, Neo está activo y aún no contesta.
  const ultimo = mensajes[mensajes.length - 1];
  const neoEscribe = esp.conIa && !esTomado && ultimo?.emisor === "cliente" && Date.now() - new Date(ultimo.providerTs).getTime() < 90_000;

  return (
    <>
      <section className="lc-hilo">
        <header className="lc-hilo-top">
          <button className="lc-ico lc-solo-movil" onClick={onVolver} title="Volver"><ArrowLeft size={18} /></button>
          <span className={`lc-av grande e-${etapa} ${esTomado ? "humano" : ""}`}>{iniciales(conv.nombre)}</span>
          <div className="lc-hilo-quien">
            <div className="lc-hilo-nombre"><b title={conv.nombre}>{conv.nombre || "Cliente"}</b><EtapaBadge c={conv} /></div>
            <small>
              {telLegible(conv.telefono)}
              {esp.conIa ? (esTomado
                ? <span className="lc-estado humano">Atiende el equipo{conv.botPausadoHasta ? ` · Neo vuelve ${hora(conv.botPausadoHasta)}` : ""}</span>
                : <span className="lc-estado bot"><CaraNeo tamano={13} /> Responde Neo AI</span>) : null}
              {!abierta ? <span className="lc-estado cerr">24 h cerrada</span> : null}
            </small>
          </div>
          <div className="lc-hilo-acc">
            {esp.conIa ? (
              esTomado
                ? <button className="lc-btn soft" disabled={ocupado} onClick={() => correr(() => devolverAlBot(conv.id), "Neo AI vuelve a responder")}><Bot size={15} /> <span>Devolver a Neo</span></button>
                : <button className="lc-btn" disabled={ocupado} onClick={() => correr(() => tomarChat(conv.id), "Chat tomado: Neo AI queda en pausa")}><UserRound size={15} /> <span>Tomar chat</span></button>
            ) : null}
            <button className="lc-ico" title="Traer de UChat ahora" disabled={ocupado} onClick={() => correr(() => refrescarHilo(conv.id))}><RefreshCw size={15} /></button>
            <button className={`lc-ico lc-solo-estrecho ${verFicha ? "on-azul" : ""}`} title="Ficha del cliente" onClick={() => setVerFicha((v) => !v)}><Info size={15} /></button>
          </div>
        </header>

        {confirmado && (ultimoPedido || conv.pedidoId) ? (
          // El chat ya trae su último pedido (pedido_id/ref/total): la banda sale al instante;
          // los productos se suman cuando llega el detalle.
          <a className="lc-banda ok" href={`/pedidos/${ultimoPedido?.id || conv.pedidoId}`}>
            <span>{ETAPA_ICO[etapa]} <b>{ETAPAS[etapa].label}</b> · {ultimoPedido?.ref || conv.pedidoRef} · {cop(ultimoPedido?.totalCop ?? conv.pedidoTotal)}
              {ultimoPedido?.items.length ? <> · {ultimoPedido.items.join(", ")}</> : null}
              {conv.pedidosNum > 1 ? <> · {conv.pedidosNum} pedidos</> : null}</span>
            <em>Ver pedido <ExternalLink size={13} /></em>
          </a>
        ) : confirmado && !cargando ? (
          <div className="lc-banda ok"><span>✅ <b>El bot marcó este chat como «Pedido creado»</b> · no se encontró el pedido por teléfono; búscalo en Pedidos.</span></div>
        ) : pideAsesor && !esTomado && esp.conIa ? (
          <div className="lc-banda ambar">
            <span>🙋 <b>Este cliente pidió hablar con un asesor.</b></span>
            <button className="lc-btn" disabled={ocupado} onClick={() => correr(() => tomarChat(conv.id), "Chat tomado")}>Atender ahora</button>
          </div>
        ) : null}

        <div className="lc-msgs">
          {cargando && !mensajes.length ? <div className="lc-vacio">Cargando conversación…</div> : null}
          {!cargando && !mensajes.length ? <div className="lc-vacio">Todavía no hay mensajes guardados de este chat. Pulsa ↻ para traerlos de UChat.</div> : null}
          {bloques.map((b) => (
            <div key={b.dia}>
              <div className="lc-dia"><span>{b.dia}</span></div>
              {b.items.map((m) => <Burbuja key={m.id} m={m} />)}
            </div>
          ))}
          {neoEscribe ? <NeoEscribiendo /> : null}
          <div ref={finRef} />
        </div>

        {aviso ? <div className={`lc-aviso ${aviso.tipo}`}>{aviso.tipo === "ok" ? <Check size={14} /> : "⚠️"} {aviso.t}</div> : null}

        {panel === "producto" ? <PanelProducto productos={productos} onCerrar={() => setPanel("")} onElegir={async (p) => { if (await correr(() => enviarProducto(conv.id, p.id), `${p.nombre} enviado`)) setPanel(""); }} /> : null}
        {panel === "imagen" ? <PanelImagen onCerrar={() => setPanel("")} onEnviar={async (u, pie) => { if (await correr(() => enviarImagen(conv.id, u, pie), "Imagen enviada")) setPanel(""); }} /> : null}
        {panel === "plantilla" ? <PanelPlantilla convId={conv.id} nombre={conv.nombre} onCerrar={() => setPanel("")} onEnviar={async (n, v) => { if (await correr(() => enviarPlantilla(conv.id, n, v), "Plantilla enviada")) setPanel(""); }} /> : null}
        {panel === "respuestas" ? (
          <div className="lc-panel">
            <div className="lc-panel-top"><b>Respuestas rápidas</b><button className="lc-ico" onClick={() => setPanel("")}><X size={15} /></button></div>
            <div className="lc-plantillas">
              {respuestas.map((r) => <button key={r.id} onClick={() => usar(r.texto)}><b>/{r.atajo}</b><span>{rellenar(r.texto, { nombre: conv.nombre, asesor: yo.nombre })}</span></button>)}
              {!respuestas.length ? <p className="lc-mut">Aún no hay respuestas rápidas. Créalas en ⚙️ Ajustes.</p> : null}
            </div>
          </div>
        ) : null}

        <footer className={`lc-comp ${modoNota ? "nota" : ""}`}>
          {!abierta && !modoNota ? (
            <div className="lc-cerrada">
              <span>⏰ Pasaron más de 24 h desde el último mensaje del cliente. WhatsApp solo deja enviar <b>plantillas aprobadas</b>.</span>
              <div>
                <button className="lc-btn" onClick={() => setPanel("plantilla")}><FileText size={15} /> Enviar plantilla</button>
                <button className="lc-btn soft" onClick={() => setModoNota(true)}><StickyNote size={15} /> Nota interna</button>
              </div>
            </div>
          ) : (
            <>
              <div className="lc-herr">
                <button className={`lc-herr-b ${modoNota ? "on" : ""}`} onClick={() => setModoNota((v) => !v)} title="El cliente no la ve"><StickyNote size={14} /> Nota</button>
                {!modoNota ? <>
                  <button className={`lc-herr-b ${panel === "respuestas" ? "on-azul" : ""}`} onClick={() => setPanel(panel === "respuestas" ? "" : "respuestas")}><Zap size={14} /> Respuestas</button>
                  <button className={`lc-herr-b ${panel === "producto" ? "on-azul" : ""}`} onClick={() => setPanel(panel === "producto" ? "" : "producto")}><Package size={14} /> Producto</button>
                  <button className={`lc-herr-b ${panel === "imagen" ? "on-azul" : ""}`} onClick={() => setPanel(panel === "imagen" ? "" : "imagen")}><ImageIcon size={14} /> Imagen</button>
                  <button className={`lc-herr-b ${panel === "plantilla" ? "on-azul" : ""}`} onClick={() => setPanel(panel === "plantilla" ? "" : "plantilla")}><FileText size={14} /> Plantilla</button>
                </> : null}
                {esp.conIa && !esTomado && !modoNota ? <span className="lc-nota-bot">Al enviar, Neo AI queda en pausa 12 h</span> : null}
                {modoNota ? <span className="lc-nota-bot">Modo nota interna: solo la ve el equipo</span> : null}
              </div>
              {sugerencias.length ? (
                <div className="lc-sug">
                  {sugerencias.map((r) => <button key={r.id} onClick={() => usar(r.texto)}><b>/{r.atajo}</b> <span>{r.texto}</span></button>)}
                </div>
              ) : null}
              <div className="lc-comp-fila">
                <textarea
                  ref={areaRef}
                  value={texto}
                  rows={1}
                  placeholder={modoNota ? "Escribe una nota para el equipo…" : "Escribe un mensaje…  (/ para respuestas rápidas)"}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (sugerencias.length && texto.startsWith("/")) usar(sugerencias[0].texto);
                      else enviar();
                    }
                  }}
                />
                <button className={`lc-enviar ${modoNota ? "nota" : ""}`} disabled={ocupado || !texto.trim()} onClick={enviar} title={modoNota ? "Guardar nota" : "Enviar (Enter)"}>
                  {modoNota ? <StickyNote size={18} /> : <Send size={18} />}
                </button>
              </div>
            </>
          )}
        </footer>
      </section>

      <Ficha conv={conv} esp={esp} rol={rol} asesores={asesores} cliente={cliente} pedidos={pedidos} abierta={verFicha}
        ocupado={ocupado} onCerrar={() => setVerFicha(false)}
        onAsignar={(id) => correr(() => asignarAsesor(conv.id, id), "Asignado")} />
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
    <aside className={`lc-ficha ${abierta ? "abierta" : ""}`}>
      <button className="lc-ico lc-ficha-x lc-solo-estrecho" onClick={onCerrar}><X size={16} /></button>
      <div className="lc-ficha-cab">
        <span className={`lc-av xl e-${etapa}`}>{iniciales(conv.nombre)}</span>
        <b>{conv.nombre || "Cliente"}</b>
        {conv.telefono ? (
          <div className="lc-ficha-tel">
            <span>{telLegible(conv.telefono)}</span>
            <button className="lc-ico mini" title="Copiar número" onClick={() => { navigator.clipboard?.writeText(conv.telefono); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}>
              {copiado ? <Check size={13} /> : <Copy size={13} />}
            </button>
            <a className="lc-ico mini" title="Abrir en WhatsApp" href={`https://wa.me/${conv.telefono}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
          </div>
        ) : null}
        <EtapaBadge c={conv} />
      </div>

      <section className="lc-card">
        <h5>Etapa de venta</h5>
        <ol className="lc-pasos">
          {PASOS.map((p, i) => (
            <li key={p} className={`${i <= paso ? "hecho" : ""} ${i === paso ? "actual" : ""}`} title={ETAPAS[p].label}>
              <span />{ETAPAS[p].corto}
            </li>
          ))}
        </ol>
        <p className="lc-paso-actual"><b>{ETAPAS[etapa].label}</b><span>Paso {paso + 1} de {PASOS.length}</span></p>
      </section>

      <section className="lc-card">
        <h5>Pedidos {pedidos.length ? <i>{pedidos.length}</i> : null}</h5>
        {pedidos.length ? pedidos.map((p) => {
          const est = ESTADO_PEDIDO[p.estado || ""] || { label: p.estado || "—", tono: "gris" };
          return (
            <a key={p.id} className="lc-pedido" href={`/pedidos/${p.id}`}>
              <div className="lc-pedido-fila"><b>{p.ref}</b><span className={`lc-pill t-${est.tono}`}>{est.label}</span></div>
              {p.items.length ? <div className="lc-pedido-items">{p.items.join(" · ")}</div> : null}
              <div className="lc-pedido-fila lc-mut">
                <span>{fecha(p.createdAt)}{p.ciudad ? ` · ${p.ciudad}` : ""}</span><b className="lc-total">{cop(p.totalCop)}</b>
              </div>
              {p.guia ? <div className="lc-mut">🚚 {p.transportadora || "Guía"} {p.guia}</div> : null}
            </a>
          );
        }) : <p className="lc-mut">Sin pedidos con este cliente o teléfono.</p>}
      </section>

      <section className="lc-card">
        <h5>Conversación</h5>
        <dl>
          <dt>Ventana 24 h</dt><dd>{ventana(conv) ? <span className="lc-pill t-verde">Abierta</span> : <span className="lc-pill t-rojo">Cerrada</span>}</dd>
          {esp.conIa ? <><dt>Responde</dt><dd>{tomado(conv) ? "Equipo (Neo en pausa)" : <FirmaNeo />}</dd></> : null}
          <dt>Asesor</dt>
          <dd>
            {rol === "admin" ? (
              <select value={conv.asesorId || ""} disabled={ocupado} onChange={(e) => onAsignar(e.target.value || null)}>
                <option value="">Sin asignar</option>
                {asesores.filter((a) => a.activo).map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            ) : asesores.find((a) => a.id === conv.asesorId)?.nombre || "Sin asignar"}
          </dd>
          <dt>Canal</dt><dd>{conv.canal}</dd>
        </dl>
        {conv.etiquetas.length ? <div className="lc-tags">{conv.etiquetas.map((t) => <span key={t}>{t}</span>)}</div> : null}
      </section>

      <section className="lc-card">
        <h5>Cliente (CRM)</h5>
        {cliente ? (
          <dl>
            <dt>Ciudad</dt><dd>{[cliente.ciudad, cliente.departamento].filter(Boolean).join(", ") || "—"}</dd>
            {cliente.direccion ? <><dt>Dirección</dt><dd>{cliente.direccion}</dd></> : null}
            <dt>Estado</dt><dd>{cliente.estado || "—"}</dd>
            <dt>Compras</dt><dd>{cliente.numPedidos || 0} · {cop(cliente.totalGastado)}</dd>
            {cliente.ultimoProductoVisto ? <><dt>Vio</dt><dd>{cliente.ultimoProductoVisto}</dd></> : null}
            {cliente.notas ? <><dt>Notas</dt><dd>{cliente.notas}</dd></> : null}
          </dl>
        ) : <p className="lc-mut">Aún no está en el CRM: se crea cuando el bot lo registra o hace un pedido.</p>}
        {tags.length ? <div className="lc-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div> : null}
      </section>
      <p className="lc-mut lc-ns">UChat · {conv.userNs}</p>
      <PoweredNeo />
    </aside>
  );
}

function Burbuja({ m }: { m: Msg }) {
  if (m.emisor === "sistema") return <div className="lc-evento"><span>{m.texto} · {hora(m.providerTs)}</span></div>;
  if (m.emisor === "nota") return <div className="lc-notai"><b>📝 Nota interna · {m.autor || "equipo"}</b><p>{m.texto}</p><small>{hora(m.providerTs)}</small></div>;
  const lado = m.emisor === "cliente" ? "izq" : "der";
  const pendiente = m.providerMsgId.startsWith("panel:");
  const quien = m.emisor === "ia" ? <FirmaNeo /> : m.emisor === "cliente" ? null : `${m.autor || "Asesor"} · equipo`;
  return (
    <div className={`lc-b ${lado} ${m.emisor}`}>
      {quien ? <span className="lc-b-quien">{quien}</span> : null}
      {m.tipo === "image" && m.mediaUrl ? <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt="" loading="lazy" /></a> : null}
      {m.tipo === "video" && m.mediaUrl ? <video src={m.mediaUrl} controls preload="none" /> : null}
      {m.tipo === "audio" && m.mediaUrl ? <audio src={m.mediaUrl} controls preload="none" /> : null}
      {m.tipo === "file" && m.mediaUrl ? <a className="lc-archivo" href={m.mediaUrl} target="_blank" rel="noreferrer">📎 Abrir archivo</a> : null}
      {m.texto ? <p className={m.tipo === "audio" ? "lc-transc" : ""}>{m.tipo === "audio" ? <><small className="lc-transc-et">Transcripción</small>«{m.texto}»</> : m.texto}</p> : null}
      <small className="lc-b-hora">{hora(m.providerTs)}{pendiente ? " · enviando…" : m.direccion === "out" ? " ✓✓" : ""}</small>
    </div>
  );
}

function PanelProducto({ productos, onElegir, onCerrar }: { productos: Producto[]; onElegir: (p: Producto) => void; onCerrar: () => void }) {
  const [q, setQ] = useState("");
  const t = q.trim().toLowerCase();
  const lista = productos.filter((p) => !t || p.nombre.toLowerCase().includes(t)).slice(0, 60);
  return (
    <div className="lc-panel">
      <div className="lc-panel-top"><b>Enviar producto</b><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" /><button className="lc-ico" onClick={onCerrar}><X size={15} /></button></div>
      <p className="lc-mut lc-panel-nota">Se envía la foto y la ficha con precio y forma de pago.</p>
      <div className="lc-prods">
        {lista.map((p) => (
          <button key={p.id} onClick={() => onElegir(p)}>
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
        {/^https:\/\/\S+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url) ? <img className="lc-prev-img" src={url} alt="" /> : null}
        <input value={pie} onChange={(e) => setPie(e.target.value)} placeholder="Texto que va después (opcional)" />
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
      <div className="lc-panel-top"><b>Plantillas de WhatsApp</b><button className="lc-ico" onClick={onCerrar}><X size={15} /></button></div>
      {err ? <p className="lc-error" style={{ margin: 12 }}>{err}</p> : null}
      {!lista && !err ? <p className="lc-mut lc-panel-nota">Cargando plantillas de UChat…</p> : null}
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
      <div className="lc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lc-panel-top"><b>Ajustes del Live Chat</b><button className="lc-ico" onClick={onCerrar}><X size={16} /></button></div>
        {msg ? <div className="lc-aviso ok estatico"><Check size={14} /> {msg}</div> : null}
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
        <p className="lc-mut">Se usan escribiendo «/atajo» en el chat o con el botón Respuestas. Puedes usar {"{nombre}"} y {"{asesor}"}.</p>
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

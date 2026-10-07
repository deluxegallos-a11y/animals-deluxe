/* LIVE CHAT — lógica pura (lib/livechat/puro.ts), sin DB ni red.
   Los mensajes tienen la forma REAL de GET /subscriber/chat-messages del
   workspace «animals deluxe» (oct-2026), con datos sintéticos. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clasificarMensaje, ecoDelPanel, elegirAsesor, espacioDeUserNs, espacioPorFlow, fechaUchat, leerConfig,
  leerPlantillas, normalizarTelefono, rellenar, ventanaAbierta, vistaPrevia,
} from "@/lib/livechat/puro";

const CFG = leerConfig({
  activo: true,
  espacios: [
    { codigo: "bot", flow_ns: "f280503", uchat_token_env: "UCHAT_API_TOKEN", con_ia: true },
    { codigo: "directo", flow_ns: "f999001", uchat_token_env: "UCHAT_TOKEN_AD_DIRECT", reparto: true },
    { codigo: "malo", flow_ns: "f1", uchat_token_env: "token-con-minusculas" }, // se descarta
    { codigo: "bot", flow_ns: "f280504", uchat_token_env: "OTRO" }, // código repetido: se descarta
  ],
});

test("config: valida espacios, nunca acepta un token como nombre de variable", () => {
  assert.equal(CFG.activo, true);
  assert.deepEqual(CFG.espacios.map((e) => e.codigo), ["bot", "directo"]);
  assert.equal(CFG.espacios[0].con_ia, true);
  assert.equal(CFG.espacios[1].con_ia, false);
  assert.equal(CFG.espacios[1].reparto, true);
  assert.equal(leerConfig({ activo: true, espacios: [] }).activo, false);
  assert.equal(leerConfig(null).activo, false);
  // Un token pegado por error en uchat_token_env no pasa la validación (token inventado).
  assert.equal(leerConfig({ activo: true, espacios: [{ codigo: "bot", flow_ns: "f280503", uchat_token_env: "abcDEF123ghiJKL456mnoPQR" }] }).activo, false);
});

test("espacio por user_ns y por flow", () => {
  assert.equal(espacioDeUserNs(CFG, "f280503u986640483")?.codigo, "bot");
  assert.equal(espacioDeUserNs(CFG, "f999001u1")?.codigo, "directo");
  assert.equal(espacioDeUserNs(CFG, "f2805031u1"), null); // prefijo parecido, otro flow
  assert.equal(espacioPorFlow(CFG, "f999001")?.codigo, "directo");
});

test("fechas de UChat vienen en UTC", () => {
  assert.equal(fechaUchat("2026-10-07 20:53:28")?.toISOString(), "2026-10-07T20:53:28.000Z");
  assert.equal(fechaUchat(""), null);
  assert.equal(fechaUchat("basura"), null);
});

const base = { user_ns: "f280503u1", agent_id: 0, paused_diff_seconds: 0 };

test("clasifica cliente, bot, humano, audio transcrito, imagen, nota", () => {
  const cli = clasificarMensaje({ ...base, mid: "wamid.A", id: 1, type: "in", msg_type: "text", sender_id: "f280503u1",
    payload: { text: "Hola, info del ENERGY COBRA" }, content: "Hola, info del ENERGY COBRA", username: "Luis", ts: 1791406374 })!;
  assert.equal(cli.emisor, "cliente");
  assert.equal(cli.direccion, "in");
  assert.equal(cli.providerMsgId, "wamid.A");
  assert.equal(cli.ts.toISOString(), new Date(1791406374 * 1000).toISOString());

  const bot = clasificarMensaje({ ...base, mid: "wamid.B", type: "out", msg_type: "text", sender_id: "bot", payload: { text: "¡Hola mi rey!" }, username: "Bot", ts: 1 })!;
  assert.equal(bot.emisor, "ia");
  assert.equal(bot.autor, "Bot IA");

  const humano = clasificarMensaje({ ...base, mid: "wamid.C", type: "agent", msg_type: "image", sender_id: "bot", agent_id: 317775,
    payload: { type: "image", url: "https://www.uchat.com.au/media/x.png", title: "ENERGY COBRA 70.000" }, username: "gomez", ts: 2 })!;
  assert.equal(humano.emisor, "asesor_uchat");
  assert.equal(humano.tipo, "image");
  assert.equal(humano.mediaUrl, "https://www.uchat.com.au/media/x.png");
  assert.equal(humano.texto, "ENERGY COBRA 70.000");

  const audio = clasificarMensaje({ ...base, mid: "wamid.D", type: "in", msg_type: "audio", sender_id: "f280503u1",
    payload: { type: "audio", url: "https://www.uchat.com.au/media/a.mp3", transcribed_text: "¿En qué parte se aplica?" }, content: "", ts: 3 })!;
  assert.equal(audio.tipo, "audio");
  assert.equal(audio.texto, "¿En qué parte se aplica?");

  const feed = clasificarMensaje({ ...base, mid: "c1", type: "in", msg_type: "feed", payload: { text: "Para animales o personas?", item: "comment" }, ts: 4 })!;
  assert.equal(feed.tipo, "text");

  const nota = clasificarMensaje({ ...base, id: 99, type: "note", msg_type: "note", payload: { text: "Llamar mañana" }, ts: 5 })!;
  assert.equal(nota.emisor, "nota");
  assert.equal(nota.providerMsgId, "id:99"); // sin mid → id numérico

  assert.equal(clasificarMensaje({ ...base, mid: "vacío", type: "out", msg_type: "text", payload: {} }), null);
  assert.equal(clasificarMensaje({ ...base, type: "in" }), null); // sin id no se puede deduplicar
  // Prefijo por workspace para que ids repetidos entre workspaces no choquen.
  assert.equal(clasificarMensaje({ ...base, mid: "X", type: "in", payload: { text: "hola" } }, "directo:")!.providerMsgId, "directo:X");
});

test("vista previa de la bandeja", () => {
  assert.equal(vistaPrevia({ tipo: "audio", texto: "" }), "🎤 Nota de voz");
  assert.equal(vistaPrevia({ tipo: "image", texto: "Precio" }), "📷 Foto · Precio");
  assert.equal(vistaPrevia({ tipo: "text", texto: "  hola \n mi rey " }), "hola mi rey");
});

test("eco del panel: empareja texto (tildes/espacios) y media, no duplica", () => {
  const t0 = new Date("2026-10-07T20:00:00Z");
  const pend = [
    { id: "p1", tipo: "text", texto: "Te envío la guía mañana", mediaUrl: "", ts: t0 },
    { id: "p2", tipo: "image", texto: "", mediaUrl: "https://animalsdeluxe.com/products/a.jpg", ts: t0 },
  ];
  let n = 0;
  const eco = (o: Record<string, unknown>) => clasificarMensaje({ ...base, mid: `e${n++}`, type: "agent", agent_id: 1, ts: t0.getTime() / 1000 + 5, ...o })!;
  assert.equal(ecoDelPanel(pend, eco({ msg_type: "text", payload: { text: "te envio  la guia mañana" } })), "p1");
  assert.equal(ecoDelPanel(pend, eco({ msg_type: "text", payload: { text: "otro texto" } })), null);
  // UChat re-aloja la imagen: el enlace cambia, se empareja por tipo y hora.
  assert.equal(ecoDelPanel(pend, eco({ msg_type: "image", payload: { url: "https://www.uchat.com.au/media/z.jpg" } })), "p2");
  // Lo que escribe el bot nunca es eco del panel.
  assert.equal(ecoDelPanel(pend, clasificarMensaje({ ...base, mid: "b", type: "out", sender_id: "bot", payload: { text: "Te envío la guía mañana" }, ts: t0.getTime() / 1000 })!), null);
  // Fuera del margen de 10 min no se empareja.
  assert.equal(ecoDelPanel(pend, eco({ msg_type: "text", payload: { text: "Te envío la guía mañana" }, ts: t0.getTime() / 1000 + 3600 })), null);
});

test("ventana de 24 h", () => {
  const ahora = new Date("2026-10-08T12:00:00Z");
  assert.equal(ventanaAbierta(new Date("2026-10-07T12:00:01Z"), ahora), true);
  assert.equal(ventanaAbierta(new Date("2026-10-07T11:59:59Z"), ahora), false);
  assert.equal(ventanaAbierta(null, ahora), false);
});

test("reparto: continuidad, luego el que menos lleva hoy, luego semana, luego nombre", () => {
  const C = [{ id: "a", nombre: "Andrés" }, { id: "l", nombre: "Laura" }];
  assert.deepEqual(elegirAsesor(C, "l", { l: 9 }, {}), { asesor: C[1], motivo: "continuidad" });
  assert.equal(elegirAsesor(C, "fuera", { a: 2, l: 1 }, {})!.asesor.id, "l"); // el previo ya no está → equitativo
  assert.equal(elegirAsesor(C, null, { a: 1, l: 1 }, { a: 3, l: 5 })!.asesor.id, "a");
  assert.equal(elegirAsesor(C, null, {}, {})!.asesor.id, "a");
  assert.equal(elegirAsesor([], null, {}, {}), null);
  // Simulación: 300 chats nuevos en un día → diferencia máxima 1.
  const hoy: Record<string, number> = {};
  const T = [...C, { id: "m", nombre: "Mario" }];
  for (let i = 0; i < 300; i++) { const e = elegirAsesor(T, null, hoy, {})!; hoy[e.asesor.id] = (hoy[e.asesor.id] || 0) + 1; }
  const v = Object.values(hoy);
  assert.ok(Math.max(...v) - Math.min(...v) <= 1);
});

test("teléfono y placeholders", () => {
  assert.equal(normalizarTelefono("+573204506714"), "573204506714");
  assert.equal(normalizarTelefono("320 450 6714"), "573204506714");
  assert.equal(rellenar("Hola {nombre}, te habla {asesor} .", { nombre: "Luis Baracaldo", asesor: "Laura" }), "Hola Luis, te habla Laura.");
  assert.equal(rellenar("Hola {nombre}!", { nombre: "" }), "Hola!");
});

test("plantillas: solo las aprobadas de texto se pueden mandar desde la bandeja", () => {
  const ps = leerPlantillas({ data: [
    { name: "estado_envio_cliente", status: "APPROVED", language: "es", namespace: "ns1",
      components: [{ type: "BODY", text: "📦 {{1}}, tu pedido de {{2}} va así: {{3}}." }] },
    { name: "promo_img", status: "APPROVED", namespace: "ns1", components: [{ type: "HEADER", format: "IMAGE" }, { type: "BODY", text: "Hola {{1}}" }] },
    { name: "nueva", status: "PENDING", components: [{ type: "BODY", text: "x" }] },
  ] });
  assert.equal(ps[0].variables, 3);
  assert.equal(ps[0].noCompatible, null);
  assert.match(ps[1].noCompatible || "", /imagen/);
  assert.match(ps[2].noCompatible || "", /aprobada/);
});

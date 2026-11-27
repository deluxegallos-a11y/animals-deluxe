/* ===========================================================
   Live Chat · sincronización UChat → base local.
   - sincronizarEspacio: 1 llamada a /subscribers (los 100 más recientes),
     actualiza el resumen de cada chat y baja los mensajes de los que se
     movieron (máx. MAX_HILOS por pasada, para no gastar el cupo del token).
   - sincronizarConversacion: /chat-messages de un chat, clasifica, empareja
     los ecos de lo enviado desde el panel y recalcula el resumen.
   Límites entre instancias con «claims» atómicos en la base:
     bot: 12 s por espacio · 3 s por chat; sin IA: 60 s · 30 s (trampas.md: 429).
   =========================================================== */
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { livechatConversaciones as conv, livechatMensajes as msg } from "@/lib/db/schema";
import {
  clasificarMensaje, ecoDelPanel, elegirAsesor, fechaUchat, nombresEtiquetas, normalizarTelefono, vistaPrevia,
  type Espacio, type PendientePanel,
} from "./puro";
import { clienteUchat, infoSuscriptor, listarSuscriptores, mensajesDe, ErrorLivechat } from "./uchat";
import { configDeTenant, filas } from "./datos";

const MAX_HILOS = 16; // por pasada, en segundo plano (after) y de a 4 en paralelo
const limites = (e: Espacio) => (e.con_ia ? { espacio: 12, chat: 3 } : { espacio: 60, chat: 30 });
const prefijo = (e: Espacio) => (e.codigo === "bot" ? "" : `${e.codigo}:`);

type Conv = typeof conv.$inferSelect;

/** true si esta instancia gana el turno de sincronizar el espacio. */
async function reclamarEspacio(tenantId: string, e: Espacio, forzar: boolean): Promise<boolean> {
  if (!db) return false;
  await db.execute(sql`insert into livechat_sync (tenant_id, espacio) values (${tenantId}, ${e.codigo}) on conflict do nothing`);
  const seg = forzar ? 2 : limites(e).espacio;
  const r = filas(await db.execute(sql`
    update livechat_sync set ultimo_sync_at = now()
     where tenant_id = ${tenantId} and espacio = ${e.codigo}
       and (ultimo_sync_at is null or ultimo_sync_at < now() - make_interval(secs => ${seg}))
    returning espacio`));
  return r.length > 0;
}

async function anotarError(tenantId: string, e: Espacio, error: string) {
  if (!db) return;
  await db.execute(sql`update livechat_sync set ultimo_error = ${error.slice(0, 300)} where tenant_id = ${tenantId} and espacio = ${e.codigo}`);
}

/** `alFondo`: si se pasa, la descarga de hilos no se espera (la bandeja responde
 *  ya con los resúmenes y los hilos llegan en segundo plano, p. ej. con after()). */
export async function sincronizarEspacio(
  tenantId: string, e: Espacio,
  opts: { forzar?: boolean; alFondo?: (trabajo: () => Promise<unknown>) => void } = {},
) {
  if (!db) return { ok: false, motivo: "sin_db" };
  if (!(await reclamarEspacio(tenantId, e, !!opts.forzar))) return { ok: true, saltado: true };
  try {
    const c = clienteUchat(e);
    const subs = await listarSuscriptores(c, 1, 100);
    const filasSub = subs
      .map((sub) => ({
        tenantId,
        espacio: e.codigo,
        userNs: String(sub.user_ns || ""),
        nombre: String(sub.name || [sub.first_name, sub.last_name].filter(Boolean).join(" ") || "").trim(),
        telefono: normalizarTelefono(sub.phone || sub.user_id),
        canal: String(sub.channel || "whatsapp").replace("_cloud", ""),
        ultimoAt: fechaUchat(sub.last_message_at) ?? fechaUchat(sub.last_interaction),
        ventanaAbierta: typeof sub.allow_send_message === "boolean" ? sub.allow_send_message : null,
        etiquetas: nombresEtiquetas(sub.tags),
      }))
      // Sin repetidos: ON CONFLICT DO UPDATE no puede tocar la misma fila dos veces.
      .filter((f, i, todas) => f.userNs.startsWith(e.flow_ns + "u") && todas.findIndex((x) => x.userNs === f.userNs) === i);
    if (!filasSub.length) { await anotarError(tenantId, e, ""); return { ok: true, suscriptores: 0, movidos: 0 }; }

    // Solo se escriben los chats nuevos o que cambiaron (último mensaje o ventana): 1 lectura + 1 upsert en lote.
    const previas = new Map(
      (await db.select({ userNs: conv.userNs, ultimoAt: conv.ultimoAt, ventana: conv.ventanaAbierta, sync: conv.mensajesSyncAt, id: conv.id, etiquetas: conv.etiquetas })
        .from(conv).where(and(eq(conv.tenantId, tenantId), inArray(conv.userNs, filasSub.map((f) => f.userNs)))))
        .map((r) => [r.userNs, r]),
    );
    const cambiadas = filasSub.filter((f) => {
      const p = previas.get(f.userNs);
      return !p || (f.ultimoAt && (!p.ultimoAt || f.ultimoAt > p.ultimoAt)) || f.ventanaAbierta !== p.ventana
        || JSON.stringify(f.etiquetas) !== JSON.stringify(p.etiquetas ?? []);
    });
    const tocadas = cambiadas.length
      ? await db.insert(conv).values(cambiadas).onConflictDoUpdate({
          target: [conv.tenantId, conv.userNs],
          set: {
            nombre: sql`case when excluded.nombre <> '' then excluded.nombre else ${conv.nombre} end`,
            telefono: sql`case when excluded.telefono <> '' then excluded.telefono else ${conv.telefono} end`,
            canal: sql`excluded.canal`,
            ventanaAbierta: sql`excluded.ventana_abierta`,
            etiquetas: sql`excluded.etiquetas`,
            ultimoAt: sql`greatest(${conv.ultimoAt}, excluded.ultimo_at)`,
            updatedAt: sql`now()`,
          },
        }).returning()
      : [];
    if (cambiadas.length || opts.forzar) await enlazarClientesYPedidos(tenantId, e.codigo);
    // Pendientes de bajar mensajes: los que se movieron después de su última
    // sincronización (incluye el atraso de chats nunca bajados), más recientes primero.
    const estado = new Map<string, { id: string; ultimoAt: Date | null; sync: Date | null }>();
    for (const [, p] of previas) estado.set(p.userNs, { id: p.id, ultimoAt: p.ultimoAt, sync: p.sync });
    for (const t of tocadas) estado.set(t.userNs, { id: t.id, ultimoAt: t.ultimoAt, sync: t.mensajesSyncAt });
    const pendientesIds = [...estado.values()]
      .filter((x) => x.ultimoAt && (!x.sync || x.ultimoAt > x.sync))
      .sort((a, b) => b.ultimoAt!.getTime() - a.ultimoAt!.getTime())
      .map((x) => x.id);
    const movidos: Conv[] = pendientesIds.length
      ? (await db.select().from(conv).where(inArray(conv.id, pendientesIds.slice(0, MAX_HILOS))))
          .sort((a, b) => (b.ultimoAt?.getTime() ?? 0) - (a.ultimoAt?.getTime() ?? 0))
      : [];
    const bajarHilos = async () => {
      // De a 4 en paralelo: el cupo del token aguanta y la pasada baja de ~18 s a ~5 s.
      for (let i = 0; i < movidos.length; i += 4) {
        await Promise.all(movidos.slice(i, i + 4).map((f) => sincronizarConversacion(tenantId, e, f, { forzar: true }).catch(() => undefined)));
      }
    };
    if (opts.alFondo) opts.alFondo(bajarHilos);
    else await bajarHilos();
    await anotarError(tenantId, e, "");
    return { ok: true, suscriptores: subs.length, cambiados: cambiadas.length, pendientes: pendientesIds.length, bajados: movidos.length };
  } catch (err) {
    const m = err instanceof Error ? err.message : "error";
    await anotarError(tenantId, e, m);
    return { ok: false, motivo: m };
  }
}

/** Baja el hilo de UChat y lo guarda. `forzar` salta el límite por chat. */
export async function sincronizarConversacion(tenantId: string, e: Espacio, c: Conv, opts: { forzar?: boolean } = {}) {
  if (!db) return { ok: false };
  const seg = opts.forzar ? 0 : limites(e).chat;
  const claim = await db
    .update(conv)
    .set({ mensajesSyncAt: new Date() })
    .where(and(eq(conv.id, c.id), sql`(${conv.mensajesSyncAt} is null or ${conv.mensajesSyncAt} < now() - make_interval(secs => ${seg}))`))
    .returning({ id: conv.id });
  if (!claim.length) return { ok: true, saltado: true };

  const crudos = await mensajesDe(clienteUchat(e), c.userNs, 100);
  const pendientes: PendientePanel[] = (
    await db.select().from(msg).where(and(eq(msg.conversacionId, c.id), like(msg.providerMsgId, "panel:%")))
  ).map((p) => ({ id: p.id, tipo: p.tipo, texto: p.texto, mediaUrl: p.mediaUrl, ts: p.providerTs }));

  // Ya guardados → se ignoran (y así un eco nunca se empareja con algo viejo).
  const clasificados = crudos.map((raw) => ({ raw, m: clasificarMensaje(raw, prefijo(e)) }))
    .filter((x): x is { raw: Record<string, unknown>; m: NonNullable<typeof x.m> } => !!x.m);
  const conocidos = new Set(clasificados.length
    ? (await db.select({ id: msg.providerMsgId }).from(msg)
        .where(and(eq(msg.tenantId, tenantId), inArray(msg.providerMsgId, clasificados.map((x) => x.m.providerMsgId))))).map((r) => r.id)
    : []);
  const nuevos: (typeof msg.$inferInsert)[] = [];
  // UChat devuelve el más nuevo primero: se procesan en orden cronológico.
  for (const { raw, m } of [...clasificados].reverse()) {
    if (conocidos.has(m.providerMsgId)) continue;
    const eco = ecoDelPanel(pendientes, m);
    if (eco) {
      // El eco reemplaza el id provisional; se conserva autor y emisor del panel.
      await db.update(msg).set({ providerMsgId: m.providerMsgId, providerTs: m.ts, ...(m.mediaUrl ? { mediaUrl: m.mediaUrl } : {}) })
        .where(eq(msg.id, eco)).catch(() => undefined);
      pendientes.splice(pendientes.findIndex((p) => p.id === eco), 1);
      continue;
    }
    nuevos.push({
      tenantId, conversacionId: c.id, providerMsgId: m.providerMsgId, direccion: m.direccion, emisor: m.emisor,
      tipo: m.tipo, texto: m.texto, mediaUrl: m.mediaUrl, autor: m.autor, providerTs: m.ts, raw,
    });
  }
  const insertados = nuevos.length
    ? await db.insert(msg).values(nuevos).onConflictDoNothing().returning({ emisor: msg.emisor })
    : [];
  const nuevosDelCliente = insertados.filter((x) => x.emisor === "cliente").length;
  await actualizarResumen(c.id, nuevosDelCliente);
  if (e.reparto) await repartir(tenantId, c.id).catch(() => undefined);
  return { ok: true, mensajes: crudos.length, nuevos: nuevosDelCliente };
}

/** Último mensaje, último del cliente, no leídos y enlace al cliente del CRM. */
export async function actualizarResumen(conversacionId: string, _nuevosDelCliente = 0) {
  if (!db) return;
  const [ult] = await db.select().from(msg)
    .where(and(eq(msg.conversacionId, conversacionId), sql`${msg.emisor} not in ('nota','sistema')`))
    .orderBy(sql`${msg.providerTs} desc`).limit(1);
  const [cli] = filas<{ t: Date | string | null }>(await db.execute(
    sql`select max(provider_ts) t from livechat_mensajes where conversacion_id = ${conversacionId} and emisor = 'cliente'`,
  ));
  await db.update(conv).set({
    ...(ult ? { ultimoTexto: vistaPrevia(ult), ultimoEmisor: ult.emisor, ultimoAt: sql`greatest(${conv.ultimoAt}, ${new Date(ult.providerTs).toISOString()}::timestamptz)` } : {}),
    ultimoClienteAt: cli?.t ? new Date(cli.t) : null,
    // «Sin responder»: mensajes del cliente después de la última respuesta (bot o equipo).
    // Se recalcula (no se acumula) para que bajar el historial no infle el contador.
    sinLeer: sql`(select count(*)::int from livechat_mensajes m
                   where m.conversacion_id = ${conversacionId} and m.emisor = 'cliente'
                     and m.provider_ts > coalesce((select max(o.provider_ts) from livechat_mensajes o
                                                    where o.conversacion_id = ${conversacionId} and o.direccion = 'out'), 'epoch'::timestamptz))`,
    updatedAt: new Date(),
  }).where(eq(conv.id, conversacionId));
  const [c] = await db.select({ t: conv.tenantId, e: conv.espacio }).from(conv).where(eq(conv.id, conversacionId)).limit(1);
  if (c) await enlazarClientesYPedidos(c.t, c.e, conversacionId);
}

/** Reparto equitativo y fijo (solo líneas con reparto). Escribe solo si sigue sin asesor. */
export async function repartir(tenantId: string, conversacionId: string) {
  if (!db) return null;
  const [c] = await db.select().from(conv).where(eq(conv.id, conversacionId)).limit(1);
  if (!c || c.asesorId) return null;
  const candidatos = filas<{ id: string; nombre: string }>(await db.execute(sql`
    select id, nombre from advisors where tenant_id = ${tenantId} and coalesce(activo,true) and coalesce(recibe_chats,true)`));
  if (!candidatos.length) return null;
  const previo = c.telefono
    ? filas<{ asesor_id: string }>(await db.execute(sql`
        select asesor_id from livechat_conversaciones
         where tenant_id = ${tenantId} and telefono = ${c.telefono} and asesor_id is not null and id <> ${c.id}
         order by asignado_en desc nulls last limit 1`))[0]?.asesor_id ?? null
    : null;
  const conteo = async (dias: number) => Object.fromEntries(filas<{ a: string; n: number }>(await db!.execute(sql`
    select asesor_id a, count(*)::int n from livechat_conversaciones
     where tenant_id = ${tenantId} and espacio = ${c.espacio} and asesor_id is not null
       and asignado_en >= (date_trunc('day', now() at time zone 'America/Bogota') - make_interval(days => ${dias - 1})) at time zone 'America/Bogota'
     group by asesor_id`)).map((r) => [r.a, r.n]));
  const elegido = elegirAsesor(candidatos, previo, await conteo(1), await conteo(7));
  if (!elegido) return null;
  const ok = await db.update(conv)
    .set({ asesorId: elegido.asesor.id, asignadoEn: new Date(), owner: "humano" })
    .where(and(eq(conv.id, c.id), sql`${conv.asesorId} is null`)).returning({ id: conv.id });
  if (!ok.length) return null;
  await registrarEvento(tenantId, c.id, `Asignada a ${elegido.asesor.nombre} (${elegido.motivo === "continuidad" ? "ya era su cliente" : "reparto equitativo"})`);
  return elegido.asesor;
}

export async function registrarEvento(tenantId: string, conversacionId: string, texto: string, autor = "Sistema") {
  if (!db) return;
  await db.insert(msg).values({
    tenantId, conversacionId, providerMsgId: `evento:${crypto.randomUUID()}`, direccion: "event",
    emisor: "sistema", tipo: "event", texto, autor,
  });
}

/** Todas las líneas de un tenant (cron y botón «actualizar»). */
export async function sincronizarTenant(tenantId: string, opts: { forzar?: boolean } = {}) {
  const cfg = await configDeTenant(tenantId);
  if (!cfg.activo) return [];
  const out = [];
  for (const e of cfg.espacios) out.push({ espacio: e.codigo, ...(await sincronizarEspacio(tenantId, e, opts)) });
  return out;
}

/** Entrada instantánea por External Request: crea/actualiza ese chat ya. */
export async function ingresarPorUserNs(tenantId: string, e: Espacio, userNs: string) {
  if (!db) return null;
  if (!userNs.startsWith(e.flow_ns + "u")) throw new ErrorLivechat("user_ns de otro workspace");
  const [fila] = await db.insert(conv).values({ tenantId, espacio: e.codigo, userNs, ultimoAt: new Date() })
    .onConflictDoUpdate({ target: [conv.tenantId, conv.userNs], set: { updatedAt: new Date() } })
    .returning();
  if (!fila) return null;
  if (!fila.nombre || !fila.telefono) {
    // Primer contacto: nombre y teléfono salen de get-info (1 llamada, solo esta vez).
    const info = await infoSuscriptor(clienteUchat(e), userNs).catch(() => ({} as Record<string, unknown>));
    const nombre = String(info.name || [info.first_name, info.last_name].filter(Boolean).join(" ") || "").trim();
    const telefono = normalizarTelefono(info.phone || info.user_id);
    if (nombre || telefono) await db.update(conv).set({ ...(nombre ? { nombre } : {}), ...(telefono ? { telefono } : {}) }).where(eq(conv.id, fila.id));
  }
  // Después del teléfono: el reparto usa el teléfono para la continuidad.
  await sincronizarConversacion(tenantId, e, fila, { forzar: true });
  return fila.id;
}

/** Enlaza cada chat con su cliente del CRM (sub_id de UChat o teléfono) y con su
 *  último pedido NO cancelado (por cliente o por los últimos 10 dígitos del
 *  teléfono). Una sola sentencia por espacio: de aquí sale la etiqueta
 *  «Pedido confirmado» de la bandeja. */
export async function enlazarClientesYPedidos(tenantId: string, espacio: string, soloConversacion?: string) {
  if (!db) return;
  const filtro = soloConversacion ? sql`and lc.id = ${soloConversacion}` : sql``;
  await db.execute(sql`
    update livechat_conversaciones lc set customer_id = cu.id
      from customers cu
     where lc.tenant_id = ${tenantId} and lc.espacio = ${espacio} ${filtro}
       and lc.customer_id is null and cu.tenant_id = lc.tenant_id
       and (cu.uchat_sub_id = lc.user_ns
            or (lc.telefono <> '' and right(regexp_replace(coalesce(cu.telefono,''), '[^0-9]', '', 'g'), 10) = right(lc.telefono, 10)))`);
  await db.execute(sql`
    update livechat_conversaciones lc
       set pedido_id = p.id, pedido_ref = p.ref, pedido_estado = coalesce(p.estado, ''),
           pedido_total = coalesce(p.total_cop, 0), pedido_at = p.created_at, pedidos_num = p.n
      from (
        select distinct on (lc2.id) lc2.id conv_id, o.id, o.ref, o.estado, o.total_cop, o.created_at,
               count(*) over (partition by lc2.id) n
          from livechat_conversaciones lc2
          join orders o on o.tenant_id = lc2.tenant_id and coalesce(o.estado, '') <> 'cancelado'
           and ((lc2.customer_id is not null and o.customer_id = lc2.customer_id)
                or (lc2.telefono <> '' and right(regexp_replace(coalesce(o.telefono, ''), '[^0-9]', '', 'g'), 10) = right(lc2.telefono, 10)))
         where lc2.tenant_id = ${tenantId} and lc2.espacio = ${espacio} ${soloConversacion ? sql`and lc2.id = ${soloConversacion}` : sql``}
         order by lc2.id, o.created_at desc
      ) p
     where lc.id = p.conv_id
       and (lc.pedido_id is distinct from p.id or lc.pedido_estado is distinct from coalesce(p.estado, '') or lc.pedidos_num <> p.n)`);
}

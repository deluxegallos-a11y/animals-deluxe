/* ============================================================
   Meta Ads — análisis de ROI real por anuncio.
   Trae insights (gasto/impresiones/CTR) de la Marketing API y los cruza con
   las VENTAS reales de la plataforma (vía ad_map: anuncio → producto → pedidos).
   Fail-soft: si no hay credenciales, devuelve { ok:false }.
   Env: META_ADS_TOKEN, META_AD_ACCOUNT_ID.
   ============================================================ */
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaAdsConfigured(): boolean {
  return !!(process.env.META_ADS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

export type MetaInsight = { adId: string; adName: string; campaign: string; spend: number; impressions: number; clicks: number; ctr: number; cpm: number; roasMeta: number };

/** Trae los insights por anuncio de la Marketing API (con paginación). */
export async function metaFetchInsights(datePreset = "last_30d"): Promise<MetaInsight[]> {
  const token = process.env.META_ADS_TOKEN || "";
  const act = process.env.META_AD_ACCOUNT_ID || "";
  if (!token || !act) return [];
  const fields = "ad_id,ad_name,campaign_name,spend,impressions,clicks,ctr,cpm,purchase_roas";
  // Solo anuncios ACTIVOS (no pausados/archivados).
  const filtering = encodeURIComponent(JSON.stringify([{ field: "ad.effective_status", operator: "IN", value: ["ACTIVE"] }]));
  let url: string | null = `${GRAPH}/${act}/insights?level=ad&date_preset=${datePreset}&limit=200&fields=${fields}&filtering=${filtering}&access_token=${token}`;
  const out: MetaInsight[] = [];
  let guard = 0;
  try {
    while (url && guard++ < 20) {
      const r = await fetch(url);
      const j = (await r.json()) as { data?: Record<string, unknown>[]; paging?: { next?: string }; error?: unknown };
      if (j.error || !j.data) break;
      for (const a of j.data) {
        const roas = Array.isArray(a.purchase_roas) ? Number((a.purchase_roas as { value?: string }[])[0]?.value || 0) : 0;
        out.push({
          adId: String(a.ad_id || ""), adName: String(a.ad_name || ""), campaign: String(a.campaign_name || ""),
          spend: Math.round(Number(a.spend || 0)), impressions: Number(a.impressions || 0), clicks: Number(a.clicks || 0),
          ctr: Number(a.ctr || 0), cpm: Number(a.cpm || 0), roasMeta: roas,
        });
      }
      url = j.paging?.next || null;
    }
  } catch { /* fail-soft */ }
  return out;
}

export type AnuncioAnalisis = MetaInsight & {
  productos: string[];        // nombres de producto que promociona (ad_map)
  pedidos: number;            // pedidos reales atribuidos (proporcional al gasto)
  ventas: number;             // $ de ventas reales atribuidas
  cpaReal: number;            // gasto / pedidos
  roasReal: number;           // ventas / gasto
  roiReal: number;            // (ventas − gasto) / gasto
  veredicto: "escalar" | "vigilar" | "apagar" | "sin_datos";
  recomendacion: string;      // consejo en texto según las métricas
};

export type AnunciosResumen = {
  ok: boolean;
  error?: string;
  gastoTotal: number;
  ventasTotal: number;
  roasGlobal: number;
  anuncios: AnuncioAnalisis[];
  mejor: AnuncioAnalisis | null;
  peor: AnuncioAnalisis | null;
};

/** Análisis completo: insights de Meta cruzados con ventas reales por producto. */
export async function getAnunciosAnalisis(datePreset = "last_30d"): Promise<AnunciosResumen> {
  if (!metaAdsConfigured()) return { ok: false, error: "Falta META_ADS_TOKEN / META_AD_ACCOUNT_ID", gastoTotal: 0, ventasTotal: 0, roasGlobal: 0, anuncios: [], mejor: null, peor: null };
  const insights = await metaFetchInsights(datePreset);
  if (!insights.length) return { ok: false, error: "Meta no devolvió anuncios (token vencido o sin datos)", gastoTotal: 0, ventasTotal: 0, roasGlobal: 0, anuncios: [], mejor: null, peor: null };

  // ad_map: ad_id → [product_slug]; ventas por producto (pedidos no cancelados)
  const [mapRows, ventasRows, prodRows] = db
    ? await Promise.all([
        db.execute(sql`select ad_id, product_slug from ad_map`),
        db.execute(sql`select oi.product_slug, count(distinct o.id)::int pedidos, coalesce(sum(oi.subtotal_cop),0)::int ventas
                       from order_items oi join orders o on o.id = oi.order_id
                       where coalesce(o.estado,'') <> 'cancelado' group by oi.product_slug`),
        db.execute(sql`select slug, name from products`),
      ])
    : [[], [], []];

  const mapa = new Map<string, string[]>(); // ad_id → slugs
  for (const r of mapRows as unknown as { ad_id: string; product_slug: string }[]) {
    const arr = mapa.get(r.ad_id) || []; arr.push(r.product_slug); mapa.set(r.ad_id, arr);
  }
  const ventasProd = new Map<string, { pedidos: number; ventas: number }>();
  for (const r of ventasRows as unknown as { product_slug: string; pedidos: number; ventas: number }[]) ventasProd.set(r.product_slug, { pedidos: r.pedidos, ventas: r.ventas });
  const nombreProd = new Map<string, string>();
  for (const r of prodRows as unknown as { slug: string; name: string }[]) nombreProd.set(r.slug, r.name);

  // Gasto total por producto (para repartir sus ventas entre los anuncios de ese producto)
  const gastoPorProducto = new Map<string, number>();
  for (const ins of insights) for (const slug of (mapa.get(ins.adId) || [])) gastoPorProducto.set(slug, (gastoPorProducto.get(slug) || 0) + ins.spend);

  const veredictoDe = (spend: number, roas: number, pedidos: number): AnuncioAnalisis["veredicto"] => {
    if (!pedidos && spend > 30000) return "apagar";
    if (!pedidos) return "sin_datos";
    if (roas >= 2.5) return "escalar";
    if (roas >= 1.2) return "vigilar";
    return "apagar";
  };
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
  const recomendacionDe = (v: AnuncioAnalisis["veredicto"], spend: number, roas: number, pedidos: number, cpa: number, mapeado: boolean): string => {
    if (!mapeado && spend > 20000) return `Gastó ${fmt(spend)} pero no está mapeado a ningún producto — mapéalo abajo para saber si vende.`;
    if (v === "escalar") return `🔥 Tu mejor tipo de anuncio: ROAS ${roas.toFixed(1)}x, CPA de ${fmt(cpa)}. Súbele presupuesto y graba más videos parecidos.`;
    if (v === "vigilar") return `Rentable pero justo (ROAS ${roas.toFixed(1)}x). Prueba mejorar el gancho del video o afinar el público antes de escalar.`;
    if (v === "apagar" && !pedidos) return `Gastó ${fmt(spend)} y 0 pedidos. Te está quemando plata — págalo o cambia el creativo ya.`;
    if (v === "apagar") return `Pierde plata: gastó ${fmt(spend)} y solo trajo ${fmt(spend * roas)} (ROAS ${roas.toFixed(1)}x). Bájale presupuesto o cámbialo.`;
    return `Sin ventas todavía. Dale un poco más de tiempo si el gasto es bajo, o revisa el creativo.`;
  };

  const anuncios: AnuncioAnalisis[] = insights.map((ins) => {
    const slugs = mapa.get(ins.adId) || [];
    let pedidos = 0, ventas = 0;
    for (const slug of slugs) {
      const vp = ventasProd.get(slug); if (!vp) continue;
      const gp = gastoPorProducto.get(slug) || ins.spend || 1;
      const share = gp > 0 ? ins.spend / gp : 1; // reparte las ventas del producto por % de gasto del anuncio
      pedidos += vp.pedidos * share;
      ventas += vp.ventas * share;
    }
    pedidos = Math.round(pedidos); ventas = Math.round(ventas);
    const roasReal = ins.spend > 0 ? ventas / ins.spend : 0;
    const cpaReal = pedidos > 0 ? Math.round(ins.spend / pedidos) : 0;
    const veredicto = veredictoDe(ins.spend, roasReal, pedidos);
    return {
      ...ins,
      productos: slugs.map((s) => nombreProd.get(s) || s),
      pedidos, ventas, cpaReal,
      roasReal: Math.round(roasReal * 100) / 100,
      roiReal: ins.spend > 0 ? Math.round(((ventas - ins.spend) / ins.spend) * 100) / 100 : 0,
      veredicto,
      recomendacion: recomendacionDe(veredicto, ins.spend, roasReal, pedidos, cpaReal, slugs.length > 0),
    };
  }).sort((a, b) => b.spend - a.spend);

  const gastoTotal = anuncios.reduce((s, a) => s + a.spend, 0);
  const ventasTotal = anuncios.reduce((s, a) => s + a.ventas, 0);
  const conVentas = anuncios.filter((a) => a.pedidos > 0);
  const mejor = conVentas.length ? conVentas.reduce((m, a) => (a.roasReal > m.roasReal ? a : m)) : null;
  const peor = anuncios.filter((a) => a.spend > 20000).sort((a, b) => a.roasReal - b.roasReal)[0] || null;

  return { ok: true, gastoTotal, ventasTotal, roasGlobal: gastoTotal > 0 ? Math.round((ventasTotal / gastoTotal) * 100) / 100 : 0, anuncios, mejor, peor };
}

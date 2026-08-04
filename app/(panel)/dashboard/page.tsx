import { getDashboard, getAnalytics, rangoFechas, type DashboardKpis, type Analytics } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

/** Corre la promesa con un tope de tiempo; si se demora, devuelve el fallback (la página nunca cuelga). */
function conTope<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);
}

const EST = [
  { estado: "remision", label: "Remisión" }, { estado: "aprobado", label: "Orden de venta" },
  { estado: "guia", label: "Con guía" }, { estado: "despachado", label: "Despachado" }, { estado: "entregado", label: "Entregado" },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { range = "hoy", from, to } = await searchParams;
  const { label } = rangoFechas(range, from, to);

  const dashFb: DashboardKpis = {
    rangoLabel: label, pedidosHoy: 0, pedidosSemana: 0, ventasHoyCop: 0, ingresosCop: 0, aRecaudarCop: 0,
    leadsNuevos: 0, conversionPct: 0,
    pedidosWhatsapp: 0, ventasWhatsappCop: 0, whatsappPct: 0, porCanal: [],
    porEstado: EST.map((e) => ({ ...e, n: 0, monto: 0 })), topProductos: [], ultimosPedidos: [],
  };
  const anaFb: Analytics = {
    visitas30d: 0, visitasHoy: 0, visitas7d: 0, visitantes30d: 0, visitantesHoy: 0,
    pedidosWeb: 0, pedidosWhatsapp: 0, pedidosTotal: 0, porFuente: [], ventasPorCanal: [], origenes: [],
  };

  const [d, a] = await Promise.all([
    conTope(getDashboard(range, from, to), 12000, dashFb),
    conTope(getAnalytics(), 12000, anaFb),
  ]);
  return <DashboardView d={d} a={a} range={range} from={from} to={to} />;
}

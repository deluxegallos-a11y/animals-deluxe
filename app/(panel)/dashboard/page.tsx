import { getDashboard, getAnalytics } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { range = "hoy", from, to } = await searchParams;
  const [d, a] = await Promise.all([getDashboard(range, from, to), getAnalytics()]);
  return <DashboardView d={d} a={a} range={range} from={from} to={to} />;
}

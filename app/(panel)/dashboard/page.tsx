import { getDashboard, getAnalytics } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [d, a] = await Promise.all([getDashboard(), getAnalytics()]);
  return <DashboardView d={d} a={a} />;
}

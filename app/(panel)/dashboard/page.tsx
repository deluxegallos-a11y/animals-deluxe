import { getDashboard } from "@/lib/queries";
import { DashboardView } from "@/components/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
  return <DashboardView d={d} />;
}

import { listAdvisors } from "@/lib/queries";
import { AdvisorsUI } from "./advisors-ui";

export const dynamic = "force-dynamic";

export default async function AsesoresPage() {
  const asesores = await listAdvisors();
  return (
    <AdvisorsUI
      asesores={asesores.map((a) => ({
        id: a.id, nombre: a.nombre, whatsapp: a.whatsapp || "",
        activo: a.activo ?? true, pedidos: a.pedidosAsignados ?? 0,
      }))}
    />
  );
}

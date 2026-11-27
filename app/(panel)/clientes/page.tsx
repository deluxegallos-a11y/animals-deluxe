import { listCRM, listProducts } from "@/lib/queries";
import { PageHead, Card } from "@/components/ui";
import { CrmBoard, type BoardCustomer } from "./crm-board";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [rows, prods] = await Promise.all([listCRM(), listProducts()]);
  const catalog = prods.map((p) => ({ slug: p.slug, name: p.name }));
  const board: BoardCustomer[] = rows.map((r) => ({
    id: r.id, nombre: r.nombre, telefono: r.telefono, ciudad: r.ciudad, canal: r.canal,
    etapa: r.etapa, etapaManual: r.etapaManual, notas: r.notas, tags: r.tags,
    numPedidos: r.numPedidos, totalGastado: r.totalGastado,
    ultimaCompra: r.ultimaCompra ? r.ultimaCompra.toISOString() : null,
    productosComprados: r.productosComprados, productosInteres: r.productosInteres,
    compradosPedidos: r.compradosPedidos, compradosManualSlugs: r.compradosManualSlugs, interesSlugs: r.interesSlugs,
    interacciones: r.interacciones,
    createdAt: r.createdAt ? r.createdAt.toISOString() : null,
    ultimoContacto: r.ultimoContacto ? r.ultimoContacto.toISOString() : null,
  }));
  return (
    <>
      <PageHead title="CRM · Clientes" subtitle={`${rows.length} contactos · embudo, segmentación y campañas`} />
      <Card>
        <CrmBoard rows={board} catalog={catalog} />
      </Card>
    </>
  );
}

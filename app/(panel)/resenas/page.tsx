import { getAllReviews } from "@/lib/reviews";
import { PageHead, Card } from "@/components/ui";
import { ResenasUI } from "./resenas-ui";

export const dynamic = "force-dynamic";

export default async function ResenasPage() {
  const list = await getAllReviews();
  const visibles = list.filter((r) => r.estado !== "oculto").length;
  return (
    <>
      <PageHead title="Reseñas" subtitle={`${list.length} reseñas · ${visibles} visibles`} />
      <Card>
        <ResenasUI initial={list} />
      </Card>
    </>
  );
}

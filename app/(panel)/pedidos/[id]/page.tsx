import { notFound } from "next/navigation";
import { getOrderDetail } from "@/lib/queries";
import { OrderDetail } from "./order-detail";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getOrderDetail(id);
  if (!o) notFound();
  return <OrderDetail o={o} />;
}

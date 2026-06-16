import { getStoreConfigRow, listIntegrations } from "@/lib/queries";
import { ConfigUI } from "./config-ui";
import type { CiudadCobertura, Branding } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [row, integ] = await Promise.all([getStoreConfigRow(), listIntegrations()]);
  const ciudades = (row?.ciudadesCobertura as CiudadCobertura[]) || [];
  const branding = (row?.branding as Branding) || {};
  return (
    <ConfigUI
      config={{
        nombre: row?.nombre || "Animals Deluxe",
        whatsapp: row?.whatsapp || "",
        ciudadBase: row?.ciudadBase || "",
        envioDefaultCop: row?.envioDefaultCop ?? 12000,
        ciudades: ciudades.map((c) => `${c.ciudad} | ${c.costo_envio} | ${c.contraentrega ? "si" : "no"}`).join("\n"),
        mensajeBienvenida: row?.mensajeBienvenida || "",
        logoUrl: branding.logoUrl || "",
        colorPrimario: branding.colorPrimario || "#FF4D2E",
        colorAcento: branding.colorAcento || "#FFB02E",
      }}
      integraciones={integ.map((i) => ({ proveedor: i.proveedor, activo: i.activo ?? true, tiene: Boolean(i.configEnc) }))}
    />
  );
}

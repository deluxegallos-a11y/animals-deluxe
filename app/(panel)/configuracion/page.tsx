import { getStoreConfigRow, listIntegrations } from "@/lib/queries";
import { shopifyConfigured } from "@/lib/shopify";
import { ConfigUI } from "./config-ui";
import type { CiudadCobertura, Branding, CuentaBancaria, CodFormConfig } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const [row, integ, shopifyOn] = await Promise.all([getStoreConfigRow(), listIntegrations(), shopifyConfigured()]);
  const ciudades = (row?.ciudadesCobertura as CiudadCobertura[]) || [];
  const cuentas = (row?.cuentasBancarias as CuentaBancaria[]) || [];
  const branding = (row?.branding as Branding) || {};
  const codForm = (row?.codForm as CodFormConfig) || {};
  return (
    <ConfigUI
      shopifyOn={shopifyOn}
      config={{
        nombre: row?.nombre || "Animals Deluxe",
        whatsapp: row?.whatsapp || "",
        ciudadBase: row?.ciudadBase || "",
        envioDefaultCop: row?.envioDefaultCop ?? 12000,
        ciudades: ciudades.map((c) => `${c.ciudad} | ${c.costo_envio} | ${c.contraentrega ? "si" : "no"}`).join("\n"),
        cuentas: cuentas.map((c) => `${c.banco} | ${c.tipo} | ${c.numero} | ${c.titular}`).join("\n"),
        mensajeBienvenida: row?.mensajeBienvenida || "",
        logoUrl: branding.logoUrl || "",
        colorPrimario: branding.colorPrimario || "#FF4D2E",
        colorAcento: branding.colorAcento || "#FFB02E",
        upsellEnabled: !!codForm.upsellEnabled,
        upsellTitulo: codForm.upsellTitulo || "",
        upsellDesc: codForm.upsellDesc || "",
        upsellPrecioCop: codForm.upsellPrecioCop || 0,
      }}
      integraciones={integ.map((i) => ({ proveedor: i.proveedor, activo: i.activo ?? true, tiene: Boolean(i.configEnc) }))}
    />
  );
}

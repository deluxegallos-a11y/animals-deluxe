"use client";

import * as React from "react";
import { PageHead, Card, CardHead } from "@/components/ui";
import { ImageUpload, SubmitButton } from "@/components/forms";
import { saveStoreConfig, saveIntegration } from "../actions";

type Cfg = {
  nombre: string; whatsapp: string; ciudadBase: string; envioDefaultCop: number;
  ciudades: string; mensajeBienvenida: string; logoUrl: string; colorPrimario: string; colorAcento: string;
};
type Integ = { proveedor: string; activo: boolean; tiene: boolean };

export function ConfigUI({ config, integraciones }: { config: Cfg; integraciones: Integ[] }) {
  const [tab, setTab] = React.useState<"tienda" | "integraciones">("tienda");
  const [logoUrl, setLogoUrl] = React.useState(config.logoUrl);
  const [msg, setMsg] = React.useState("");
  const has = (p: string) => integraciones.find((i) => i.proveedor === p)?.tiene;

  async function onSaveStore(formData: FormData) {
    formData.set("logoUrl", logoUrl);
    const res = await saveStoreConfig(formData);
    setMsg(res?.ok ? "✅ Configuración guardada." : (res?.error === "demo" ? "Modo demo: no se guarda." : "No se pudo guardar."));
  }
  async function onSaveInteg(formData: FormData) {
    const res = await saveIntegration(formData);
    setMsg(res?.ok ? "✅ Integración guardada (cifrada)." : "No se pudo guardar.");
  }

  return (
    <>
      <PageHead title="Configuración" subtitle="Tienda, cobertura, branding e integraciones" />
      <div className="tabs">
        <a className={tab === "tienda" ? "active" : ""} onClick={() => setTab("tienda")}>Tienda</a>
        <a className={tab === "integraciones" ? "active" : ""} onClick={() => setTab("integraciones")}>Integraciones</a>
      </div>
      {msg ? <div className="form-msg ok" style={{ marginBottom: 16 }}>{msg}</div> : null}

      {tab === "tienda" ? (
        <div className="cfg-grid">
          <Card>
            <CardHead icon="🏪" title="Datos de la tienda" />
            <form action={onSaveStore} id="store-form">
              <div className="field"><label>Nombre</label><input name="nombre" defaultValue={config.nombre} /></div>
              <div className="field-row">
                <div className="field"><label>WhatsApp</label><input name="whatsapp" defaultValue={config.whatsapp} placeholder="573001234567" /></div>
                <div className="field"><label>Ciudad base</label><input name="ciudadBase" defaultValue={config.ciudadBase} /></div>
              </div>
              <div className="field"><label>Envío por defecto (COP)</label><input name="envioDefaultCop" defaultValue={config.envioDefaultCop} /></div>
              <div className="field">
                <label>Ciudades de cobertura</label>
                <textarea name="ciudades" rows={5} defaultValue={config.ciudades} placeholder={"Medellín | 0 | si\nBogotá | 12000 | si\nLeticia | 25000 | no"} />
                <span className="field-hint">Una por línea: <code>ciudad | costo_envio | si/no contraentrega</code>. Sin lista = cobertura nacional contraentrega.</span>
              </div>
              <div className="field"><label>Mensaje de bienvenida</label><textarea name="mensajeBienvenida" rows={2} defaultValue={config.mensajeBienvenida} /></div>
              <div className="field-row">
                <div className="field"><label>Color primario</label><input name="colorPrimario" type="color" defaultValue={config.colorPrimario} style={{ height: 44, padding: 4 }} /></div>
                <div className="field"><label>Color acento</label><input name="colorAcento" type="color" defaultValue={config.colorAcento} style={{ height: 44, padding: 4 }} /></div>
              </div>
              <ImageUpload name="logoUrl" label="Logo" defaultUrl={logoUrl} folder="branding" />
              <SubmitButton>Guardar configuración</SubmitButton>
            </form>
          </Card>

          <Card>
            <CardHead icon="🚚" title="Cómo funciona la cobertura" />
            <p className="t-mut" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
              El bot consulta <code>/api/ai/cobertura</code> con la ciudad del cliente. Si la ciudad está en tu lista,
              usa su costo de envío y su bandera de contraentrega. Si no la listas, responde cobertura nacional
              contraentrega con el envío por defecto. El total del pedido suma este envío automáticamente.
            </p>
          </Card>
        </div>
      ) : (
        <div className="cfg-grid">
          <Card>
            <CardHead icon="🤖" title="UChat" right={<span className={has("uchat") ? "badge-plan pro" : "badge-plan starter"}>{has("uchat") ? "Configurado" : "Pendiente"}</span>} />
            <form action={onSaveInteg}>
              <input type="hidden" name="proveedor" value="uchat" />
              <div className="field"><label>Token / API key de UChat</label><input name="token" type="password" placeholder={has("uchat") ? "•••••••• (guardado)" : "pega el token"} /></div>
              <span className="field-hint">Se guarda cifrado con AES-256.</span>
              <SubmitButton>Guardar UChat</SubmitButton>
            </form>
          </Card>
          <Card>
            <CardHead icon="💳" title="Wompi (anticipo opcional)" right={<span className={has("wompi") ? "badge-plan pro" : "badge-plan starter"}>{has("wompi") ? "Configurado" : "Pendiente"}</span>} />
            <form action={onSaveInteg}>
              <input type="hidden" name="proveedor" value="wompi" />
              <div className="field"><label>Llave privada Wompi</label><input name="token" type="password" placeholder={has("wompi") ? "•••••••• (guardado)" : "prv_test_..."} /></div>
              <span className="field-hint">Cifrada AES-256. La firma de webhooks usa WOMPI_EVENTS_SECRET en el entorno.</span>
              <SubmitButton>Guardar Wompi</SubmitButton>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

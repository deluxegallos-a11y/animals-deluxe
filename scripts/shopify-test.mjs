/* ===========================================================
   Prueba en vivo de la integración Shopify (GraphQL Admin API).
   Crea un producto de prueba (con 2 variantes/presentaciones) y una
   orden COD, replicando exactamente lo que hace lib/shopify.ts.
   Úsalo contra una DEV STORE.

   Ejecutar:
     node --env-file=.env.local scripts/shopify-test.mjs
   (requiere SHOPIFY_STORE_DOMAIN y SHOPIFY_ADMIN_API_TOKEN en .env.local)
   =========================================================== */

const domain = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const token = process.env.SHOPIFY_ADMIN_API_TOKEN || "";
const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";
const OPTION_NAME = "Presentación";

if (!domain || !token) {
  console.error("❌ Faltan SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN. Corre con: node --env-file=.env.local scripts/shopify-test.mjs");
  process.exit(1);
}

const url = `https://${domain}/admin/api/${apiVersion}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const PRODUCT_SET = `
  mutation($input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(input: $input, synchronous: $synchronous) {
      product { id title variants(first: 100) { nodes { id selectedOptions { name value } } } }
      userErrors { field message }
    }
  }`;

const ORDER_CREATE = `
  mutation($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) { order { id name } userErrors { field message } }
  }`;

async function main() {
  console.log(`🛒 Shopify dev store: ${domain} (API ${apiVersion})\n`);

  // 1) Crear producto con 2 presentaciones (variantes)
  const presentaciones = [
    { label: "30 ml · ~40 dosis", priceCOP: 70000 },
    { label: "100 ml · ~130 dosis", priceCOP: 180000 },
  ];
  const setInput = {
    title: "TEST · Animals Deluxe (borrar)",
    descriptionHtml: "<p>Producto de prueba creado por scripts/shopify-test.mjs</p>",
    status: "ACTIVE",
    tags: ["TEST", "Suplementos"],
    productOptions: [{ name: OPTION_NAME, values: presentaciones.map((p) => ({ name: p.label })) }],
    variants: presentaciones.map((p) => ({
      optionValues: [{ optionName: OPTION_NAME, name: p.label }],
      price: String(p.priceCOP),
    })),
  };
  const pRes = await gql(PRODUCT_SET, { input: setInput, synchronous: true });
  if (pRes.productSet.userErrors.length) throw new Error("productSet: " + JSON.stringify(pRes.productSet.userErrors));
  const product = pRes.productSet.product;
  console.log("✅ Producto creado:", product.id, `(${product.title})`);
  const variants = product.variants.nodes.map((v) => ({
    id: v.id, label: v.selectedOptions.find((o) => o.name === OPTION_NAME)?.value,
  }));
  variants.forEach((v) => console.log(`   • variante ${v.label} → ${v.id}`));

  // 2) Crear orden COD con la primera variante
  const order = {
    currency: "COP",
    financialStatus: "PENDING",
    tags: ["COD", "WhatsApp", "Bot"],
    note: "Pedido contraentrega de prueba (scripts/shopify-test.mjs)",
    lineItems: [{ variantId: variants[0].id, quantity: 2 }],
    shippingAddress: {
      firstName: "Cliente", lastName: "Prueba",
      address1: "Vereda El Gallo", city: "Medellín", phone: "573001234567", countryCode: "CO",
    },
  };
  const oRes = await gql(ORDER_CREATE, {
    order,
    options: { sendReceipt: false, sendFulfillmentReceipt: false, inventoryBehaviour: "DECREMENT_IGNORING_POLICY" },
  });
  if (oRes.orderCreate.userErrors.length) throw new Error("orderCreate: " + JSON.stringify(oRes.orderCreate.userErrors));
  const o = oRes.orderCreate.order;
  console.log("\n✅ Orden creada:", o.name, `(${o.id})`);
  console.log("\n🎉 Integración Shopify verificada. Borra el producto/orden de prueba en el admin si quieres.");
}

main().catch((e) => { console.error("\n❌ Falló la prueba:", e.message); process.exit(1); });

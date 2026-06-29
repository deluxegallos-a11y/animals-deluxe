import { SITE, PRODUCTS, FAQS } from "@/components/gallos/_lib/data";

/** Schema.org: Organization, WebSite, Product, FAQPage (handoff §8). */
export function JsonLd() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE.domain}/#org`,
      name: SITE.name,
      url: SITE.domain,
      description: SITE.description,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.domain}/#website`,
      url: SITE.domain,
      name: SITE.name,
      inLanguage: "es-CO",
    },
    ...PRODUCTS.map((p) => ({
      "@type": "Product",
      name: p.name,
      description: p.description,
      image: `${SITE.domain}${p.image}`,
      brand: { "@type": "Brand", name: SITE.name },
      offers: {
        "@type": "Offer",
        price: p.price,
        priceCurrency: p.currency,
        availability: "https://schema.org/InStock",
      },
    })),
    {
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}

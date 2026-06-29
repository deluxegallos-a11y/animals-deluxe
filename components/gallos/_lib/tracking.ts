// Wrapper único de analítica. No-op si los IDs no están configurados.
// Eventos del handoff sección 8.
type EventName =
  | "view_page"
  | "view_product"
  | "select_product"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "click_whatsapp"
  | "faq_open"
  | "scroll_depth"
  | "submit_review";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (e: string, p?: Record<string, unknown>) => void };
  }
}

export function track(event: EventName, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  // GA4
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
  window.gtag?.("event", event, params);
  // Meta Pixel — mapeo a eventos estándar
  const fbMap: Partial<Record<EventName, string>> = {
    view_product: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
    purchase: "Purchase",
  };
  if (fbMap[event]) window.fbq?.("track", fbMap[event], params);
  // TikTok
  window.ttq?.track(event, params);

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[track]", event, params);
  }
}

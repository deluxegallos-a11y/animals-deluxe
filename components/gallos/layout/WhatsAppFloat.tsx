"use client";

import { Icon } from "@/components/gallos/shared/Icon";
import { SITE } from "@/components/gallos/_lib/data";
import { track } from "@/components/gallos/_lib/tracking";

export function WhatsAppFloat() {
  return (
    <a
      href={`https://wa.me/${SITE.whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      onClick={() => track("click_whatsapp", {})}
      className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-dragon text-white shadow-[0_8px_30px_rgba(39,195,74,0.5)] transition-transform hover:scale-105 md:bottom-6"
    >
      <Icon name="whatsapp" size={28} />
    </a>
  );
}

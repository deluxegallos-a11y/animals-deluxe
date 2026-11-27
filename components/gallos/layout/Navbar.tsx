"use client";

import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/gallos/shared/Button";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCart } from "@/components/gallos/_lib/useCart";

const LINKS = [
  { href: "#productos", label: "Productos" },
  { href: "#testimonios", label: "Testimonios" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [solid, setSolid] = useState(false);
  const [menu, setMenu] = useState(false);
  const { count, open } = useCart();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-9 z-50 transition-colors duration-300 ${
        solid
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:h-20">
        <a
          href="#top"
          aria-label="Inicio"
          className={`transition-opacity duration-300 ${solid ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-sm font-medium text-white/80 transition-colors hover:text-gold"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <button
            onClick={open}
            aria-label="Abrir carrito"
            className="relative grid h-11 w-11 place-items-center rounded-[20px] border border-border bg-surface text-white transition-colors hover:border-gold/60"
          >
            <Icon name="cart" size={20} />
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-[#050505]">
                {count}
              </span>
            )}
          </button>

          <div className="hidden md:block">
            <Button
              variant="primary"
              icon="arrow-right"
              onClick={() =>
                document
                  .querySelector("#productos")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Comprar
            </Button>
          </div>

          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Menú"
            className="grid h-11 w-11 place-items-center rounded-[20px] border border-border bg-surface text-white md:hidden"
          >
            <Icon name={menu ? "close" : "menu"} size={20} />
          </button>
        </div>
      </nav>

      {menu && (
        <div className="border-t border-border bg-background/95 backdrop-blur-md md:hidden">
          <ul className="flex flex-col px-6 py-4">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setMenu(false)}
                  className="block py-3 text-base font-medium text-white/85"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}

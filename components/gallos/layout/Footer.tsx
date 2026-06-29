import { Logo } from "./Logo";
import { Icon } from "@/components/gallos/shared/Icon";
import { SITE } from "@/components/gallos/_lib/data";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 pb-28 pt-16 md:pb-16">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-white/55">
            Suplementos premium para tus animales de competencia. Máximo
            rendimiento, fuerza y energía. Envío a todo Colombia.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="mb-3 font-heading text-base text-white">Líneas</h4>
            <ul className="space-y-2 text-white/55">
              <li>
                <a href="/gallos" className="hover:text-gold">
                  Gallos
                </a>
              </li>
              <li>
                <a href="/caballos" className="hover:text-gold">
                  Caballos
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-gold">
                  Preguntas frecuentes
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-heading text-base text-white">Legal</h4>
            <ul className="space-y-2 text-white/55">
              <li>
                <a href="#" className="hover:text-gold">
                  Términos y condiciones
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gold">
                  Política de privacidad
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-gold">
                  Envíos y devoluciones
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <h4 className="mb-3 font-heading text-base text-white">Contacto</h4>
          <a
            href={`https://wa.me/${SITE.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-[20px] border border-dragon/40 bg-dragon/10 px-4 py-2.5 text-sm font-semibold text-dragon transition-colors hover:bg-dragon/20"
          >
            <Icon name="whatsapp" size={18} /> Escríbenos por WhatsApp
          </a>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-7xl border-t border-border pt-6 text-center text-xs text-white/40">
        © {new Date().getFullYear()} {SITE.name}. Todos los derechos reservados.
        Producto de uso responsable.
      </div>
    </footer>
  );
}

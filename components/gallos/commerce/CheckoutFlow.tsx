"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/gallos/shared/Icon";
import { useCheckout } from "@/components/gallos/_lib/useCheckout";
import { CodForm, type CodItem } from "@/components/store/cod-form";

const fmt = (n: number) => "$" + n.toLocaleString("es-CO");

/* Asistente de compra por pasos (animado). Lo dispara cualquier botón de compra:
   genérico -> empieza en "¿cuál quieres?"; específico -> directo al pago. */
export function CheckoutFlow() {
  const {
    accent,
    open,
    step,
    choices,
    selected,
    ref,
    loading,
    pick,
    payCod,
    payAnticipado,
    setDone,
    back,
    close,
  } = useCheckout();

  const grad = `linear-gradient(180deg, ${accent.from} 0%, ${accent.to} 100%)`;
  const subtotal = selected.reduce((s, p) => s + p.price, 0);

  const codItems: CodItem[] = selected.map((p) => ({
    slug: p.id,
    name: p.name,
    presLabel: "",
    qty: 1,
    priceCOP: p.price,
    imageUrl: p.image,
  }));

  const stepVariants = {
    initial: { opacity: 0, x: 34 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -34 },
  };

  // El formulario contraentrega es su propio overlay (encima de todo).
  const showCod = open && step === "cod";

  return (
    <>
      <AnimatePresence>
        {open && step !== "cod" && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <motion.div
              className="relative w-full max-w-md overflow-hidden rounded-t-[28px] border border-white/10 bg-gradient-to-b from-[#12121a] to-[#0a0a0e] p-6 shadow-[0_30px_70px_rgba(0,0,0,0.6)] sm:rounded-[28px] sm:p-7"
              initial={{ y: 60, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "tween", duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cerrar */}
              <button
                onClick={close}
                aria-label="Cerrar"
                className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:text-white"
              >
                <Icon name="close" size={16} />
              </button>

              {/* Pasos animados */}
              <AnimatePresence mode="wait">
                {/* ---------- PASO 1: ¿CUÁL QUIERES? ---------- */}
                {step === "product" && (
                  <motion.div
                    key="product"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p
                      className="font-ui text-[11px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: accent.solid }}
                    >
                      Paso 1 de 2
                    </p>
                    <h3 className="font-heading mt-1.5 text-[26px] leading-tight text-white">
                      ¿Cuál quieres?
                    </h3>
                    <p className="font-ui mt-1 text-sm text-white/55">
                      Elige tu opción para continuar.
                    </p>

                    <div className="mt-5 space-y-3">
                      {choices.map((c) => (
                        <button
                          key={c.label}
                          onClick={() => pick(c.products)}
                          className="group flex w-full items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/30"
                        >
                          <span className="flex-1">
                            <span className="font-ui block text-[15px] font-semibold text-white">
                              {c.label}
                            </span>
                            {c.sub && (
                              <span className="font-ui mt-0.5 block text-[13px] text-white/55">
                                {c.sub}
                              </span>
                            )}
                          </span>
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#0a0a0e] transition-transform group-hover:scale-105"
                            style={{ background: grad, color: accent.ink }}
                          >
                            <Icon name="arrow-right" size={17} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ---------- PASO 2: ¿CÓMO QUIERES PAGAR? ---------- */}
                {step === "pay" && (
                  <motion.div
                    key="pay"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {choices.length > 0 && (
                      <button
                        onClick={back}
                        className="font-ui mb-2 inline-flex items-center gap-1 text-xs font-medium text-white/45 transition-colors hover:text-white"
                      >
                        ← Cambiar producto
                      </button>
                    )}
                    <p
                      className="font-ui text-[11px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: accent.solid }}
                    >
                      Paso 2 de 2
                    </p>
                    <h3 className="font-heading mt-1.5 text-[26px] leading-tight text-white">
                      ¿Cómo quieres pagar?
                    </h3>

                    {/* Resumen de lo elegido */}
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                      {selected.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 py-0.5"
                        >
                          <span className="font-ui truncate text-[13px] text-white/75">
                            {p.name}
                            {p.subtitle ? ` · ${p.subtitle}` : ""}
                          </span>
                          <span className="font-ui shrink-0 text-[13px] font-semibold text-white">
                            {fmt(p.price)}
                          </span>
                        </div>
                      ))}
                      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="font-ui text-xs uppercase tracking-wide text-white/45">
                          Total
                        </span>
                        <span className="font-ui text-base font-bold text-white">
                          {fmt(subtotal)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <button
                        onClick={payCod}
                        className="flex w-full items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/30"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xl">
                          💵
                        </span>
                        <span className="flex-1">
                          <span className="font-ui block text-sm font-semibold text-white">
                            Pagar contraentrega
                          </span>
                          <span className="font-ui block text-xs text-white/50">
                            Pagas cuando recibes el pedido en tu casa
                          </span>
                        </span>
                        <Icon name="arrow-right" size={18} />
                      </button>

                      <button
                        onClick={payAnticipado}
                        disabled={loading}
                        className="flex w-full items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-white/30 disabled:opacity-60"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xl">
                          💳
                        </span>
                        <span className="flex-1">
                          <span className="font-ui block text-sm font-semibold text-white">
                            {loading ? "Redirigiendo…" : "Pago anticipado"}
                          </span>
                          <span className="font-ui block text-xs text-white/50">
                            Transferencia Bancolombia o PSE (pasarela segura)
                          </span>
                        </span>
                        <Icon name="arrow-right" size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ---------- PASO FINAL: ¡GRACIAS! ---------- */}
                {step === "done" && (
                  <motion.div
                    key="done"
                    variants={stepVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="py-2 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 220, damping: 16, delay: 0.05 }}
                      className="mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl"
                      style={{ background: grad, color: accent.ink }}
                    >
                      ✓
                    </motion.div>
                    <h3 className="font-heading mt-4 text-[26px] leading-tight text-white">
                      ¡Gracias por tu compra!
                    </h3>
                    <p
                      className="font-ui mt-1 text-[13px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: accent.solid }}
                    >
                      Bienvenido a Animals Deluxe
                    </p>
                    <p className="font-ui mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-white/65">
                      Recibimos tu pedido
                      {ref ? (
                        <>
                          {" "}
                          (ref <b className="text-white">{ref}</b>)
                        </>
                      ) : null}
                      . Un asesor te contacta para confirmar el envío. Pagas
                      cuando recibes en la puerta de tu casa. 🐾
                    </p>
                    <button
                      onClick={close}
                      className="font-ui mt-6 w-full rounded-full py-3.5 text-sm font-semibold uppercase tracking-tight"
                      style={{ background: grad, color: accent.ink }}
                    >
                      Listo
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* El formulario contraentrega: mismo de la página principal. Al enviarlo
          con éxito avanza a la pantalla de "¡Gracias!". */}
      {showCod && (
        <CodForm
          items={codItems}
          onClose={close}
          onSuccess={(r) => setDone(r)}
        />
      )}
    </>
  );
}

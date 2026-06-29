/** PostCSS — Tailwind v4 solo procesa archivos con directivas de Tailwind
 *  (la landing /gallos usa @import "tailwindcss" en app/gallos/gallos.css).
 *  El CSS plano del resto del proyecto (globals.css, store-theme.css, admin.css)
 *  no tiene esas directivas y pasa sin transformar. */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

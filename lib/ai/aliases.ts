/* ===========================================================
   CEREBRO DE IDENTIFICACIÓN — Catálogo de ALIAS y NECESIDADES (rooster-deluxe)

   Fuente de verdad en código (determinística y testeable). La tabla
   `product_aliases` de Supabase se siembra desde aquí (scripts/seed-aliases.mjs)
   y se MEZCLA en runtime, para que Edwin pueda agregar alias desde el panel
   sin necesidad de deploy.

   Un alias puede apuntar a VARIOS slugs (ej. "botas" → las 3 botas): en ese caso
   la respuesta es `ambiguous` con esas opciones.
   =========================================================== */

export type AliasEntry = {
  /** Slugs a los que apunta. Más de uno → ambiguous. */
  slugs: string[];
  /** Formas en que el cliente lo escribe (typos, apodos, jerga). */
  aliases: string[];
  /** Aclaración obligatoria al responder (ej. "solo manejamos las normales"). */
  nota?: string;
};

export const ALIAS_CATALOG: AliasEntry[] = [
  /* ---------- DOPING / ENERGIZANTES ---------- */
  { slugs: ["red-dopping-mamba"], aliases: ["rebamba", "red manba", "red bamba", "la mamba", "mamba roja", "mamba", "red mamba", "red doping mamba"] },
  { slugs: ["dopping-dragon-mamba"], aliases: ["dragon mamba", "dragon", "mamba inyeccion oral", "dragon mamba oral", "doping dragon"] },
  { slugs: ["super-dragon-mamba"], aliases: ["super dragon mamba", "super dragon", "super mamba"] },
  { slugs: ["rooster-fury"], aliases: ["furi", "fury", "el furi", "american fury", "american rooster fury", "la furia"] },
  { slugs: ["atp-fighter-rooster"], aliases: ["atp", "el atp", "fighter", "atp fighter"] },
  { slugs: ["atp-rooster-gold"], aliases: ["atp gold", "gold", "atp dorado"] },
  { slugs: ["energy-cobra"], aliases: ["cobra", "la cobra", "energi cobra", "energy cobra"] },
  { slugs: ["super-energy-77"], aliases: ["la 77", "energy 77", "super 77", "el 77", "77"] },
  { slugs: ["super-energizante-b15-5500-ultra"], aliases: ["b15", "b15 5500", "el b15", "ultra 5500", "super energizante"] },
  { slugs: ["top-b15-3"], aliases: ["top b15", "b15 mas 3", "top b15 3"] },
  { slugs: ["forzen-b15"], aliases: ["forzen", "frozen b15", "forcen"] },
  { slugs: ["equi-gan"], aliases: ["equigan", "eki gan", "equigan inyectable", "equi gan"] },
  { slugs: ["super-trainer"], aliases: ["trainer", "pre entreno", "preentreno", "super trainer"] },

  /* ---------- VITAMINAS / SUPLEMENTOS ---------- */
  { slugs: ["rooster-booster"], aliases: ["booster", "buster", "el buster", "rooster buster"] },
  { slugs: ["nordic-rooster"], aliases: ["nordic", "nordica", "nordico"] },
  { slugs: ["super-b12-max"], aliases: ["b12 max", "super b12", "b12max"] },
  { slugs: ["super-vitamina-b12-5500-inyectable"], aliases: ["b12 5500", "la 5500", "super vitamina", "super vitamina b12", "vitamina b12 5500"] },
  { slugs: ["cyano-max"], aliases: ["siano max", "cyano", "ciano max", "sianomax", "cianomax", "ciano"] },
  { slugs: ["ultra-gallo-b12-5500"], aliases: ["ultra gallo", "ultragallo", "ultra gallo b12"] },
  { slugs: ["rooster-complet"], aliases: ["complet", "complete", "b12 complete", "rooster complete"] },
  { slugs: ["super-vit-7500-inyectable"], aliases: ["vit 7500", "la 7500", "super vit", "7500"] },
  { slugs: ["catosal"], aliases: ["catozal", "katosal", "catosal"] },
  { slugs: ["red-cell"], aliases: ["redcel", "red sel", "celula roja", "red cell"] },
  { slugs: ["gallomin"], aliases: ["galomin", "gallomin pastillas", "gayomin"] },
  { slugs: ["chicks-vitamax"], aliases: ["vitamax", "chick vitamax", "bitamax"] },
  { slugs: ["nutri-cal"], aliases: ["nutrical", "nutri cal"] },
  { slugs: ["super-tron-b12"], aliases: ["supertron", "tron b12", "super tron"] },
  { slugs: ["weight-muscle"], aliases: ["weight", "proteina liquida", "wei muscle", "weight muscle", "guei muscle"] },
  { slugs: ["vitalmin-rooster"], aliases: ["vitalmin", "bitalmin", "vitalmin rooster"] },
  { slugs: ["dragon-rooster"], aliases: ["dragon pastillas", "dragon rooster"] },
  { slugs: ["the-avianpro"], aliases: ["avian pro", "avianpro", "etapa de cuido", "abian pro"] },
  { slugs: ["perlas-de-higado-de-bacalao"], aliases: ["perlas", "higado de bacalao", "bacalao", "perlas de higado"] },
  { slugs: ["omega-3"], aliases: ["omega", "omega tres", "omega 3"] },
  { slugs: ["champions-choice"], aliases: ["champions", "choice", "champion choice", "champions choice"] },
  { slugs: ["compleland-b12-oral"], aliases: ["compleland", "compleland b12"] },
  { slugs: ["complemil-oral"], aliases: ["complemil", "complemil oral"] },
  { slugs: ["hepatogan"], aliases: ["epatogan", "hepatogan protector", "protector de higado"] },
  { slugs: ["rooster-deluxe-max"], aliases: ["deluxe max", "polvo max", "el polvo rojo", "rooster max"] },
  { slugs: ["rooster-deluxe-suplement"], aliases: ["suplement", "suplemento deluxe", "deluxe suplement"] },
  { slugs: ["rooster-deluxe-chicks"], aliases: ["chicks", "polvo pollitos", "deluxe chicks", "deluxe pollitos"] },
  { slugs: ["hens"], aliases: ["hens", "hens gallinas", "polvo gallinas"] },
  { slugs: ["vita-power"], aliases: ["vitapower", "bita power", "vita power"] },
  { slugs: ["ascarbol-inyectable"], aliases: ["ascarbol", "ascarbol inyectable", "ascarbol vitaminico"] },
  { slugs: ["poultry-prime"], aliases: ["poultry", "prime pollitos", "poultri"] },
  { slugs: ["nutripeep-reforce"], aliases: ["nutripeep", "nutri peep", "reforce"] },
  { slugs: ["rooster-strength"], aliases: ["strength", "rooster strength"] },
  { slugs: ["super-cobra-500"], aliases: ["cobra 500", "super cobra"] },

  /* ---------- RECUPERACIÓN ---------- */
  { slugs: ["gallo-post-recovery"], aliases: ["recovery", "post recovery", "recuperador", "gallo post recovery"] },

  /* ---------- VERMÍFUGOS ---------- */
  { slugs: ["gallo-purga"], aliases: ["gallopurga", "purga plus", "gallo purga plus", "gallo purga"] },
  { slugs: ["galliverm-super"], aliases: ["galiverm", "galliverm", "galiber", "galliverm super"] },
  { slugs: ["rooster-end-worm"], aliases: ["end worm", "endworm", "and worm", "rooster worm"] },
  { slugs: ["panacur"], aliases: ["panacur", "panacur purga"] },
  { slugs: ["gallomec-plus"], aliases: ["gallomec", "galomec", "gallomek", "gallomec plus"] },
  { slugs: ["vermi-ultra"], aliases: ["vermiultra", "bermi ultra", "vermi ultra"] },
  { slugs: ["vermicina-vermifugo"], aliases: ["bermicina", "vermisina", "bermisina", "vermicina"] },
  { slugs: ["purgebeak"], aliases: ["purgebeak", "purge beak", "purgebeack", "purgueback", "purguebeak"] },

  /* ---------- RESPIRATORIO / CURACIÓN ---------- */
  { slugs: ["septibron-forte"], aliases: ["septibron", "septibrom", "septibron forte"] },
  {
    slugs: ["cure-chest-for-rooster-gotas", "cure-chest-for-rooster-pastillas"],
    aliases: ["cure chest", "curechest", "kiur chest", "pecho", "cure chest for rooster"],
  },
  { slugs: ["clear-chicks-gotas"], aliases: ["clear chick", "clearchicks", "gotas pollitos mocos", "clear chicks"] },
  { slugs: ["promicina-corticoide-n-f"], aliases: ["promicina", "promisina", "reemplazo pembex", "pembex"] },
  { slugs: ["fighter-s-vision"], aliases: ["vision", "gotas ojos", "crema ojos", "fighters vision", "fighter vision"] },
  { slugs: ["karate-kill"], aliases: ["karate", "karatekill", "karate kill"] },
  { slugs: ["beak-boost"], aliases: ["beak", "crema pico", "boqueras", "beak boost", "bik bust"] },
  { slugs: ["trueno-oro-inyectable"], aliases: ["trueno", "trueno de oro", "trueno oro"] },
  { slugs: ["clotetrasone-nf"], aliases: ["clotetrasone", "clotetrazone", "clotetrasona"] },
  { slugs: ["pollon-premium"], aliases: ["pollon polvo", "pollon premium"] },
  { slugs: ["pollon-oro-gotas"], aliases: ["pollon gotas", "pollon de oro", "pollon oro"] },
  { slugs: ["pollon-premium", "pollon-oro-gotas"], aliases: ["pollon", "poyon"] },
  { slugs: ["ciclosona-inyectable"], aliases: ["siclosona", "ciclosona", "ciclosona inyectable"] },
  { slugs: ["rooster-smallpox"], aliases: ["smallpox", "viruela", "bubas", "crema viruela", "esmolpox"] },
  { slugs: ["percloruro"], aliases: ["percloruro", "para la sangre", "pa la sangre", "pa sangre"] },

  /* ---------- HIGIENE ---------- */
  { slugs: ["shampoo-plume-king"], aliases: ["plume king", "shampoo", "champu", "shampu", "plum king"] },
  { slugs: ["lice-free"], aliases: ["lice free", "piojos", "antipiojos", "laisfri", "lice"] },
  { slugs: ["red-rooster"], aliases: ["enrojecedor", "red rooster litro", "red rooster"] },
  { slugs: ["rooster-shave"], aliases: ["shave", "crema afeitar", "afeitadora", "rooster shave", "cheiv"] },

  /* ---------- IMPLEMENTOS ---------- */
  {
    slugs: ["botas-cuero", "botas-canilleras", "botas-goma"],
    aliases: ["botas", "bota", "boticas", "botas de entrenar", "juego de botas", "botas de entrenamiento"],
  },
  { slugs: ["botas-cuero"], aliases: ["botas de cuero", "bota cuero"] },
  { slugs: ["botas-canilleras"], aliases: ["canilleras", "canillera", "botas canilleras"] },
  { slugs: ["botas-goma"], aliases: ["botas de goma", "bota goma", "botas caucho"] },
  {
    slugs: ["mona"],
    aliases: ["mona", "monas", "muneco de entrenamiento", "muneca", "saco de entrenamiento", "monas de cabo", "corretear", "muneco", "munequito"],
  },
  { slugs: ["tijera-roja", "tijera-truper"], aliases: ["tijeras", "tijera", "motilar", "tijeras de motilar"] },
  { slugs: ["tijera-roja"], aliases: ["tijera roja"] },
  { slugs: ["tijera-truper"], aliases: ["truper", "tijera truper"] },
  { slugs: ["espadadrapo-blanco", "espadadrapo-color"], aliases: ["esparadrapo", "espadrapo", "cinta", "tape", "espadadrapo"] },
  { slugs: ["espadadrapo-blanco"], aliases: ["esparadrapo blanco", "espadadrapo blanco"] },
  { slugs: ["espadadrapo-color"], aliases: ["esparadrapo de color", "espadadrapo color"] },
  { slugs: ["corta-espuela"], aliases: ["cortaespuelas", "corta espuelas", "corta espuela", "cortaespuela"] },
  { slugs: ["cera-dominicana", "cera-nacional"], aliases: ["cera", "ceras"] },
  { slugs: ["cera-dominicana"], aliases: ["cera dominicana", "dominicana"] },
  { slugs: ["cera-nacional"], aliases: ["cera nacional", "nacional"] },
  { slugs: ["piquera-peruana"], aliases: ["piqueras", "piquera", "vinchas pico", "piquera peruana"] },
  {
    slugs: ["patapiojas"],
    aliases: ["pata piojas", "patapiojas", "patapiojas altas", "parrillas de 90", "parrillas de 90 grados", "parrilla de 90", "patapiojas normales"],
    nota: "De patapiojas solo manejamos las *normales* (no altas ni parrillas de 90°).",
  },
  { slugs: ["placas-personalizadas"], aliases: ["placas", "plaquitas", "vinchas", "pa marcar", "marcar pollos", "placas personalizadas", "plaqueta"] },
  { slugs: ["candados", "candados-cobre"], aliases: ["candado", "candados"] },
  { slugs: ["candados-cobre"], aliases: ["candados de cobre", "candado cobre"] },
  { slugs: ["trabas"], aliases: ["traba", "trabas"] },
  {
    slugs: ["comedero-profundo", "comedero-media-luna", "comedero-pollitos-largo", "comedero-8-huecos-pollitos"],
    aliases: ["comedero", "comederos", "coquitas", "coquita", "bebedero"],
  },

  /* ---------- ALIMENTOS Y CUIDO ---------- */
  { slugs: ["avena"], aliases: ["avena", "avena preparada"] },
  { slugs: ["cinta-azul"], aliases: ["cinta azul", "cuido azul"] },
  { slugs: ["master-pollito"], aliases: ["master pollito", "master", "cuido pollitos", "comida pollitos", "comida para pollitos", "cuido de pollitos"] },
];

/* ===========================================================
   PASO 4 — NECESIDAD → productos/categoría
   El orden importa: las frases más específicas van primero (se evalúa en orden
   y gana la primera que matchea). "cuido" solo → vitaminas; "cuido alimento" → comida.
   =========================================================== */

export type NeedRule = {
  id: string;
  /** Frases/palabras del cliente (ya normalizadas: sin tildes, minúsculas). */
  match: string[];
  /** Productos concretos (prioridad) — se muestran máx 3, en este orden. */
  slugs?: string[];
  /** …o toda una categoría. */
  categorySlug?: string;
};

export const NEED_RULES: NeedRule[] = [
  // --- frases específicas primero ---
  { id: "cola-emplume", match: ["que le crezca la cola", "que les crezca la cola", "crezca la cola", "crecer la cola", "emplumar", "emplume", "que emplume", "cria de polola", "cola"], slugs: ["omega-3", "vitalmin-rooster", "rooster-deluxe-max"] },
  { id: "agua-pollitos", match: ["agua de los pollitos", "agua para pollitos"], slugs: ["clear-chicks-gotas", "cure-chest-for-rooster-gotas", "septibron-forte"] },
  { id: "comida", match: ["cuido alimento", "comida", "alimento", "concentrado", "alimentar", "de comer", "cuido diario"], slugs: ["avena", "cinta-azul", "master-pollito"] },
  { id: "respiratorio", match: ["moquillo", "gripa", "mocos", "moco", "respiratorio", "ahogado", "ahogo", "tos", "estornuda", "ronquera", "pal moquillo", "para el moquillo"], slugs: ["cure-chest-for-rooster-gotas", "cure-chest-for-rooster-pastillas", "clear-chicks-gotas", "septibron-forte"] },
  { id: "purga", match: ["purga", "purgar", "desparasitar", "desparasitante", "desparasitantes", "vermifugo", "vermifugos", "lombriz", "lombrices", "gusano", "gusanos", "parasito", "parasitos", "parasitosis"], slugs: ["gallo-purga", "galliverm-super", "vermi-ultra", "vermicina-vermifugo"] },
  { id: "doping", match: ["pelea", "peleas", "energia", "dope", "doping", "dopin", "que lo levante", "energizante", "para la pelea", "topada"], categorySlug: "doping-energizantes" },
  { id: "engorde", match: ["engorde", "engordar", "peso", "masa", "musculo", "musculatura", "masa muscular"], slugs: ["rooster-deluxe-max", "weight-muscle"] },
  { id: "pollitos", match: ["pollitos", "pollito", "levante", "cria", "crias"], slugs: ["rooster-deluxe-chicks", "chicks-vitamax", "master-pollito"] },
  { id: "piojos", match: ["piojos", "piojo", "pulgas", "pulga", "acaros", "acaro", "garrapata", "garrapatas"], slugs: ["lice-free", "shampoo-plume-king"] },
  { id: "viruela", match: ["viruela", "bubas", "hongos cara", "hongos en la cara"], slugs: ["rooster-smallpox"] },
  { id: "pico", match: ["boqueras", "boquera", "pico"], slugs: ["beak-boost"] },
  { id: "ojos", match: ["ojos", "ojo", "vista"], slugs: ["fighter-s-vision"] },
  { id: "recuperacion", match: ["recuperacion", "recuperar", "despues de la pelea", "post pelea"], slugs: ["gallo-post-recovery"] },
  { id: "entrenar", match: ["entrenar", "entrenamiento", "topar", "topas", "corretear", "corretiar"], slugs: ["botas-cuero", "mona", "piquera-peruana"] },
  { id: "marcar", match: ["marcar", "marcaje", "identificar"], slugs: ["placas-personalizadas"] },
  { id: "afeitar", match: ["afeitar", "motilar", "rapar"], slugs: ["rooster-shave", "tijera-roja"] },
  { id: "vitaminas", match: ["vitamina", "vitaminas", "fortalecer", "cuido", "etapa final", "fortaleza"], categorySlug: "vitaminas-y-suplementos" },
];

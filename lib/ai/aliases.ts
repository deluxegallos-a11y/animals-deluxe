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
  // "dopar" (el verbo) faltaba: "goticas para dopar los gallos" no matcheaba NADA
  // aquí y quedaba a merced del fuzzy, que lo mandaba a Botas. "goticas" en jerga
  // gallera es el doping en gotas.
  { id: "doping", match: ["pelea", "peleas", "energia", "dope", "doping", "dopin", "que lo levante", "energizante", "para la pelea", "topada", "dopar", "doparlo", "dopalo", "para dopar", "dopar los gallos", "dopar el gallo", "goticas para dopar", "gotas para dopar", "goticas", "gotica"], categorySlug: "doping-energizantes" },
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

/* ===========================================================
   ANIMALS DELUXE — MISMAS reglas, catálogo DISTINTO.
   Animals-deluxe (tenant por defecto, contra entrega) vende las mismas familias
   de gallos que Rooster + perros y caballo, pero con SLUGS y CATEGORÍAS propios
   (ej. `gallo-purga-plus` no `gallo-purga`; categoría `desparasitantes` no
   `vermifugos-desparasitantes`). No tiene implementos (botas/mona/comederos) ni
   antibióticos sueltos. Los APODOS que dice el cliente son idénticos; solo cambia
   a qué producto apuntan. `rulesForTenant()` elige el set según el tenant.
   =========================================================== */

export const ALIAS_CATALOG_ANIMALS: AliasEntry[] = [
  /* ---------- DOPING / ENERGÍA ---------- */
  { slugs: ["red-copping-mamba"], aliases: ["rebamba", "red manba", "red bamba", "la mamba", "mamba roja", "mamba", "red mamba", "red doping mamba", "red dopping mamba", "red copping mamba"] },
  { slugs: ["dragon-mamba"], aliases: ["dragon mamba", "dragon", "mamba oral", "dragon oral"] },
  { slugs: ["american-rooster-fury"], aliases: ["furi", "fury", "el furi", "american fury", "american rooster fury", "la furia"] },
  { slugs: ["atp-fighter-rooster"], aliases: ["atp", "el atp", "fighter", "atp fighter"] },
  { slugs: ["atp-rooster-gold"], aliases: ["atp gold", "gold", "atp dorado"] },
  { slugs: ["energy-cobra"], aliases: ["cobra", "la cobra", "energi cobra", "energy cobra"] },
  { slugs: ["super-energy-77"], aliases: ["la 77", "energy 77", "super 77", "el 77", "77"] },
  { slugs: ["super-energizante-b15"], aliases: ["b15", "b15 5500", "el b15", "ultra 5500", "super energizante"] },
  { slugs: ["super-trainer"], aliases: ["trainer", "pre entreno", "preentreno", "super trainer"] },
  { slugs: ["ultra-gallo"], aliases: ["ultra gallo", "ultragallo", "ultra gallo inyectable"] },
  // Rooster XT Impulsor: SOLO Rooster Deluxe (anticipado) → sin alias en Animals.
  { slugs: ["black-rooster"], aliases: ["black rooster", "gallo negro"] },
  { slugs: ["combo-del-mes"], aliases: ["combo del mes", "combo mes", "oferta del mes"] },
  { slugs: ["combo-potenciador"], aliases: ["combo potenciador", "potenciador"] },
  { slugs: ["equipo-de-campeones"], aliases: ["equipo de campeones", "kit de campeones", "kit campeones", "equipo campeones", "kit definitivo"] },

  /* ---------- VITAMINAS / SUPLEMENTOS ---------- */
  { slugs: ["rooster-booster"], aliases: ["booster", "buster", "el buster", "rooster booster"] },
  { slugs: ["nordic-rooster-vitamins"], aliases: ["nordic", "nordica", "nordico", "nordic rooster"] },
  { slugs: ["super-b12-max"], aliases: ["b12 max", "super b12", "b12max"] },
  { slugs: ["cyanomax-b12-5500"], aliases: ["siano max", "cyano", "ciano max", "sianomax", "cianomax", "ciano", "cyanomax"] },
  { slugs: ["rooscer-b12-complete"], aliases: ["complet", "complete", "b12 complete", "rooster complete", "rooscer"] },
  { slugs: ["champions-choice"], aliases: ["champions", "choice", "champion choice", "champions choice"] },
  { slugs: ["dragon-rooster"], aliases: ["dragon rooster", "dragon pastillas"] },
  { slugs: ["the-avian-pro"], aliases: ["avian pro", "avianpro", "etapa de cuido", "abian pro"] },
  { slugs: ["vitalmin-rooster"], aliases: ["vitalmin", "bitalmin", "vitalmin rooster"] },
  // VitaPower: SOLO Rooster Deluxe (anticipado) → sin alias en Animals.
  { slugs: ["rooster-strength"], aliases: ["strength", "rooster strength"] },
  { slugs: ["rooster-deluxe-max"], aliases: ["deluxe max", "polvo max", "el polvo rojo", "rooster max"] },
  { slugs: ["rooster-deluxe-supplement"], aliases: ["supplement", "suplement", "suplemento deluxe", "deluxe supplement"] },
  { slugs: ["rooster-deluxe-chicks"], aliases: ["chicks", "polvo pollitos", "deluxe chicks", "deluxe pollitos"] },

  /* ---------- DESPARASITANTES ---------- */
  // Gallo Purga Plus: SOLO Rooster Deluxe (anticipado) → sin alias en Animals.
  // "purga"/"desparasitar" caen en la regla de necesidad (Purge Beach, And Worm, Super Cobra).
  { slugs: ["purge-beach"], aliases: ["purge beach", "purgebeak", "purge beak", "purgebeack", "purguebeak"] },
  { slugs: ["rooster-and-worm"], aliases: ["and worm", "end worm", "endworm", "rooster worm", "rooster and worm"] },
  { slugs: ["super-cobra-500"], aliases: ["cobra 500", "super cobra", "super cobra 500"] },

  /* ---------- RESPIRATORIO ---------- */
  { slugs: ["cure-chest-rooster"], aliases: ["cure chest", "curechest", "kiur chest", "pecho", "cure chest for rooster"] },
  { slugs: ["clear-chicks"], aliases: ["clear chick", "clearchicks", "gotas pollitos mocos", "clear chicks"] },

  /* ---------- CUIDADO / PLUMAJE ---------- */
  { slugs: ["omega-3"], aliases: ["omega", "omega tres", "omega 3"] },
  // Plume King Shampoo: SOLO Rooster Deluxe (anticipado). "shampoo"/"champú" ahora
  // resuelven al shampoo que SÍ es de contra entrega (Rooster Deluxe Shampoo).
  { slugs: ["rooster-deluxe-shampoo"], aliases: ["rooster deluxe shampoo", "shampoo deluxe", "champu deluxe", "shampoo", "champu", "shampu", "champo"] },
  // Red Rooster (enrojecedor) es SOLO de Rooster Deluxe → NO se ofrece en Animals
  // (producto desactivado en animals-deluxe). Sin alias aquí para no resolverlo.
  { slugs: ["rooster-smallpox"], aliases: ["smallpox", "viruela", "bubas", "crema viruela", "esmolpox"] },

  /* ---------- ENTRENAMIENTO / RECUPERACIÓN ---------- */
  { slugs: ["gallo-post-recovery"], aliases: ["recovery", "post recovery", "recuperador", "gallo post recovery"] },
  { slugs: ["weight-muscle-protein"], aliases: ["weight", "proteina liquida", "wei muscle", "weight muscle", "weight muscle protein"] },
  { slugs: ["kit-entreno-recovery"], aliases: ["kit entreno", "kit entreno recovery", "entreno y recovery"] },

  /* ---------- POLLOS ---------- */
  { slugs: ["nutripeep-refoce"], aliases: ["nutripeep", "nutri peep", "refoce", "nutripeep refoce"] },
  { slugs: ["rooster-deluxe"], aliases: ["rooster deluxe pollos", "deluxe pollos"] },
  { slugs: ["combo-4-tapas"], aliases: ["combo 4 tapas", "4 tapas", "cuatro tapas", "combo tapas", "combo cuidado total"] },

  /* ---------- PERROS / CABALLOS ----------
     OJO: los alias de perro SIEMPRE nombran al perro. "more muscle" a secas NO es
     alias: el cliente gallero que escribe "more muscle"/"músculo" quería la proteína
     de gallos (Weight Muscle Protein) y el bot le mandaba el producto de perros. */
  { slugs: ["more-muscle-dogs"], aliases: ["more muscle dogs", "muscle dogs", "more muscle perro", "more muscle perros", "musculo perro", "musculo perros", "perros musculo"] },
  { slugs: ["more-muscle-dogs-3m"], aliases: ["more muscle dogs 3 meses", "muscle dogs 3 meses", "perros 3 meses"] },
  { slugs: ["horse-deluxe"], aliases: ["horse deluxe", "protein lysine", "caballo deluxe"] },
];

export const NEED_RULES_ANIMALS: NeedRule[] = [
  { id: "cola-emplume", match: ["que le crezca la cola", "que les crezca la cola", "crezca la cola", "crecer la cola", "emplumar", "emplume", "que emplume", "cola", "plumaje", "muda"], slugs: ["omega-3", "rooster-deluxe-shampoo", "rooster-deluxe-max"] },
  { id: "respiratorio", match: ["moquillo", "gripa", "mocos", "moco", "respiratorio", "ahogado", "ahogo", "tos", "estornuda", "ronquera", "pal moquillo", "para el moquillo"], categorySlug: "respiratorio" },
  { id: "purga", match: ["purga", "purgar", "desparasitar", "desparasitante", "desparasitantes", "vermifugo", "vermifugos", "lombriz", "lombrices", "gusano", "gusanos", "parasito", "parasitos", "parasitosis"], slugs: ["purge-beach", "rooster-and-worm", "super-cobra-500"] },
  { id: "doping", match: ["pelea", "peleas", "energia", "dope", "doping", "dopin", "que lo levante", "energizante", "para la pelea", "topada", "careo", "dopar", "doparlo", "dopalo", "para dopar", "dopar los gallos", "dopar el gallo", "goticas para dopar", "gotas para dopar", "goticas", "gotica"], categorySlug: "energia" },
  { id: "engorde", match: ["engorde", "engordar", "peso", "masa", "musculo", "musculatura", "masa muscular"], slugs: ["rooster-deluxe-max", "weight-muscle-protein", "gallo-post-recovery"] },
  { id: "pollitos", match: ["pollitos", "pollito", "levante", "cria", "crias", "polluelo"], slugs: ["rooster-deluxe-chicks", "nutripeep-refoce", "rooster-deluxe"] },
  { id: "piojos", match: ["piojos", "piojo", "pulgas", "pulga", "acaros", "acaro", "garrapata", "garrapatas"], slugs: ["rooster-deluxe-shampoo", "omega-3"] },
  { id: "viruela", match: ["viruela", "bubas", "hongos cara", "hongos en la cara"], slugs: ["rooster-smallpox"] },
  { id: "recuperacion", match: ["recuperacion", "recuperar", "despues de la pelea", "post pelea"], slugs: ["gallo-post-recovery"] },
  { id: "entrenar", match: ["entrenar", "entrenamiento", "topar", "topas", "pre entreno", "preentreno"], slugs: ["super-trainer", "gallo-post-recovery", "weight-muscle-protein"] },
  { id: "perros", match: ["perro", "perros", "canino", "cachorro", "musculo perro", "perro flaco"], slugs: ["more-muscle-dogs"] },
  { id: "caballos", match: ["caballo", "caballos", "equino", "yegua", "potro"], slugs: ["horse-deluxe"] },
  { id: "vitaminas", match: ["vitamina", "vitaminas", "minerales", "fortalecer", "cuido", "etapa final", "fortaleza", "apetito", "defensas", "multivitaminico"], categorySlug: "vitaminas" },
];

/* ===========================================================
   RESOLVER de reglas por tenant. El brain y las rutas /api/ai/* lo usan para
   escoger el set correcto según `tenant.slug`. Default = rooster (retrocompat
   con los tests que llaman identifyProduct sin ruleset).
   =========================================================== */
export type Ruleset = { aliases: AliasEntry[]; needs: NeedRule[] };
export const ROOSTER_RULES: Ruleset = { aliases: ALIAS_CATALOG, needs: NEED_RULES };
export const ANIMALS_RULES: Ruleset = { aliases: ALIAS_CATALOG_ANIMALS, needs: NEED_RULES_ANIMALS };

export function rulesForTenant(slug?: string): Ruleset {
  return slug === "animals-deluxe" ? ANIMALS_RULES : ROOSTER_RULES;
}

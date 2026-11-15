const ARCHETYPES = [
  { id: "product-first", label: "Product First", hero: "product-stage", visual: "product-dominant", type: "sans", score: { shop: 8, product: 7, catalog: 7, ecommerce: 8, retail: 6, technology: 3, магазин: 8, товар: 7, покупка: 6 } },
  { id: "editorial", label: "Editorial / Magazine", hero: "editorial-cover", visual: "typographic-editorial", type: "serif-mix", score: { studio: 5, brand: 5, expert: 4, fashion: 7, beauty: 4, editorial: 8, agency: 5, бренд: 5, эксперт: 4, мода: 7, красота: 4, журнал: 8 } },
  { id: "immersive", label: "Immersive Fullscreen", hero: "immersive-image", visual: "full-bleed-imagery", type: "display-sans", score: { photography: 9, photographer: 9, art: 8, event: 6, travel: 5, portfolio: 7, creative: 5, фотограф: 9, фотография: 9, портфолио: 7, искусство: 8 } },
  { id: "asymmetric", label: "Asymmetric Canvas", hero: "asymmetric-canvas", visual: "offset-composition", type: "expressive-sans", score: { creative: 7, design: 6, architecture: 5, agency: 5, service: 3, innovation: 4, креатив: 7, дизайн: 6, архитектура: 5, студия: 5 } },
  { id: "catalog", label: "Catalog / Marketplace", hero: "category-led", visual: "dense-category-grid", type: "functional-sans", score: { catalog: 9, marketplace: 9, assortment: 8, store: 7, shop: 5, equipment: 5, telescope: 7, каталог: 9, ассортимент: 8, техника: 5, телескоп: 8, оптика: 7 } },
  { id: "split-utility", label: "Split Utility", hero: "split-action-panel", visual: "dual-column-functional", type: "humanist-sans", score: { service: 8, booking: 8, consultation: 8, repair: 7, salon: 7, hair: 6, delivery: 5, услуга: 8, запись: 8, консультация: 8, ремонт: 7, салон: 7, парикмахер: 7, доставка: 5 } },
  { id: "storytelling", label: "Storytelling Scroll", hero: "narrative-entry", visual: "sequential-story", type: "serif-sans", score: { craft: 6, handmade: 7, food: 5, restaurant: 5, brand: 6, history: 7, process: 6, ремесло: 6, ручной: 7, еда: 5, ресторан: 5, кофейня: 6, кофе: 5, история: 7, процесс: 6 } },
  { id: "modular", label: "Modular Grid", hero: "modular-dashboard", visual: "multi-entry-grid", type: "geometric-sans", score: { multiservice: 8, platform: 7, company: 5, business: 4, multiple: 6, b2b: 5, платформа: 7, компания: 5, бизнес: 4, несколько: 6 } },
  { id: "brutalist", label: "Brutalist / Experimental", hero: "typographic-impact", visual: "high-contrast-graphic", type: "heavy-grotesk", score: { experimental: 9, underground: 8, music: 6, culture: 6, youth: 5, streetwear: 7, эксперимент: 9, андеграунд: 8, музыка: 7, культура: 6, молодеж: 5 } },
  { id: "minimal", label: "Minimal Conversion", hero: "focused-offer", visual: "single-focus-layout", type: "neutral-sans", score: { lead: 7, landing: 5, single: 6, urgent: 5, local: 4, narrow: 6, заявка: 7, лендинг: 5, локальный: 4 } }
];

const PALETTES = [
  { id: "mineral-light", label: "Mineral Light", background: "#F2F1EC", surface: "#FFFFFF", text: "#202522", muted: "#737A75", accent: "#315C52" },
  { id: "ink-citrus", label: "Ink & Citrus", background: "#17191C", surface: "#24282C", text: "#F4F1E8", muted: "#A9AAA5", accent: "#D9E45B" },
  { id: "clay-studio", label: "Clay Studio", background: "#E9DED2", surface: "#F7F1E9", text: "#342A26", muted: "#806F65", accent: "#B65D3C" },
  { id: "blueprint", label: "Blueprint", background: "#E8EFF5", surface: "#FFFFFF", text: "#142A40", muted: "#61758A", accent: "#2468A5" },
  { id: "botanical", label: "Botanical", background: "#E8EDE5", surface: "#F8FAF5", text: "#1F3027", muted: "#68766B", accent: "#52734D" },
  { id: "nocturne", label: "Nocturne", background: "#201E27", surface: "#302C38", text: "#F4EEF2", muted: "#B6AAB4", accent: "#C17A9A" },
  { id: "warm-paper", label: "Warm Paper", background: "#F4EBD9", surface: "#FFFAF0", text: "#2B2924", muted: "#82796A", accent: "#A45B32" },
  { id: "electric", label: "Electric", background: "#F1F0F7", surface: "#FFFFFF", text: "#19162A", muted: "#77718A", accent: "#6246EA" }
];

const TYPOGRAPHY = {
  sans: { display: "Manrope", body: "Inter", character: "clear-product-led" },
  "serif-mix": { display: "Cormorant Garamond", body: "Manrope", character: "editorial-refined" },
  "display-sans": { display: "Space Grotesk", body: "Inter", character: "visual-bold" },
  "expressive-sans": { display: "DM Sans", body: "Inter", character: "asymmetric-expressive" },
  "functional-sans": { display: "IBM Plex Sans", body: "Inter", character: "dense-functional" },
  "humanist-sans": { display: "Manrope", body: "Source Sans 3", character: "approachable-functional" },
  "serif-sans": { display: "Playfair Display", body: "Manrope", character: "narrative-warm" },
  "geometric-sans": { display: "Space Grotesk", body: "DM Sans", character: "modular-geometric" },
  "heavy-grotesk": { display: "Archivo Black", body: "DM Sans", character: "high-impact" },
  "neutral-sans": { display: "Inter", body: "Inter", character: "quiet-focused" }
};

const SECTION_PLANS = {
  "product-first": ["hero-product", "featured-products", "category-navigation", "benefits", "product-proof", "delivery-and-payment", "faq", "purchase-cta"],
  editorial: ["editorial-hero", "selected-work", "point-of-view", "process", "testimonials", "about", "contact"],
  immersive: ["immersive-hero", "full-screen-gallery", "project-stories", "services", "about-artist", "contact"],
  asymmetric: ["asymmetric-hero", "capabilities", "selected-cases", "approach", "team-or-founder", "contact"],
  catalog: ["category-hero", "category-grid", "popular-items", "selection-guide", "delivery", "faq", "catalog-cta"],
  "split-utility": ["split-hero", "service-selector", "how-it-works", "results-or-cases", "pricing", "booking-form", "faq"],
  storytelling: ["story-hero", "origin-story", "craft-or-process", "product-highlights", "social-proof", "visit-or-order"],
  modular: ["modular-hero", "service-grid", "solutions-by-need", "proof-points", "company-overview", "contact"],
  brutalist: ["statement-hero", "visual-manifesto", "featured-work", "offerings", "press-or-proof", "direct-contact"],
  minimal: ["focused-hero", "key-benefit", "proof", "offer-details", "objection-handling", "single-cta"]
};

const NAVIGATION = {
  "product-first": "commerce-header-with-search",
  editorial: "editorial-wordmark-nav",
  immersive: "overlay-minimal-nav",
  asymmetric: "offset-utility-nav",
  catalog: "category-navigation-with-search",
  "split-utility": "compact-service-nav",
  storytelling: "story-led-anchor-nav",
  modular: "multi-entry-navigation",
  brutalist: "expressive-type-nav",
  minimal: "single-goal-navigation"
};

function normalize(value = "") {
  return String(value).toLocaleLowerCase("ru-RU").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ё/g, "е");
}

function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) {
    h ^= char.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed) {
  return list[hash(seed) % list.length];
}

function includesAny(text, words) {
  return words.some(word => text.includes(normalize(word)));
}

function scoreArchetype(archetype, corpus, goal) {
  let score = 0;
  for (const [keyword, weight] of Object.entries(archetype.score)) {
    if (corpus.includes(normalize(keyword))) score += weight;
  }
  if (goal === "purchase" && ["product-first", "catalog"].includes(archetype.id)) score += 3;
  if (goal === "booking" && archetype.id === "split-utility") score += 4;
  if (goal === "portfolio" && ["immersive", "editorial"].includes(archetype.id)) score += 4;
  if (goal === "lead" && archetype.id === "minimal") score += 2;
  return score;
}

function historyPenalty(candidate, history = []) {
  let penalty = 0;
  for (const item of history.slice(-8)) {
    if (item.primaryArchetype === candidate.id) penalty += 5;
    if (item.heroComposition === candidate.hero) penalty += 4;
    if (item.visualDirection === candidate.visual) penalty += 3;
    if (item.typographyCharacter === candidate.type) penalty += 2;
  }
  return penalty;
}

function chooseArchetypes(corpus, goal, history) {
  const ranked = ARCHETYPES.map(item => ({
    ...item,
    relevance: scoreArchetype(item, corpus, goal),
    repetitionPenalty: historyPenalty(item, history)
  })).map(item => ({ ...item, finalScore: item.relevance - item.repetitionPenalty }))
    .sort((a, b) => b.finalScore - a.finalScore || a.id.localeCompare(b.id));

  const primary = ranked[0];
  const secondary = ranked.find(item => item.id !== primary.id && item.relevance > 0);
  return { primary, secondary, ranked };
}

function sectionOrder(archetype, corpus) {
  const sections = [...SECTION_PLANS[archetype.id]];
  if (includesAny(corpus, ["review", "отзыв", "testimonial"])) sections.splice(Math.max(2, sections.length - 3), 0, "customer-reviews");
  if (includesAny(corpus, ["price", "цена", "стоимость", "тариф"])) sections.splice(Math.max(2, sections.length - 2), 0, "pricing-details");
  return [...new Set(sections)];
}

function directionFor(archetype, corpus) {
  if (archetype.id === "catalog" || archetype.id === "product-first") return "clear product photography, comparison-ready product framing, restrained interface decoration";
  if (archetype.id === "immersive") return "large authored imagery, cinematic crops, image-led transitions";
  if (archetype.id === "editorial") return "art-directed photography, generous whitespace, editorial image sequencing";
  if (archetype.id === "brutalist") return "graphic typography, bold cropping, poster-like image treatment";
  if (includesAny(corpus, ["food", "restaurant", "кофе", "еда", "раки"])) return "natural food photography, tactile close-ups, warm ambient light";
  return "authentic contextual photography, purposeful crops, minimal decorative graphics";
}

function motionFor(archetype) {
  const map = {
    "product-first": "subtle product-card feedback, restrained gallery transitions, no distracting autoplay",
    editorial: "typographic reveals and measured section transitions",
    immersive: "slow image transitions and restrained scroll-linked movement",
    asymmetric: "staggered entrances that reinforce the offset composition",
    catalog: "fast filter feedback and lightweight product interactions",
    "split-utility": "immediate form feedback and short state transitions",
    storytelling: "progressive narrative reveals with reduced-motion fallback",
    modular: "consistent micro-interactions across modular entry points",
    brutalist: "sharp, short transitions and expressive hover states",
    minimal: "near-instant feedback with almost no decorative motion"
  };
  return map[archetype.id];
}

/**
 * Build a deterministic design concept. This is a heuristic engine, not an AI model.
 * @param {object} input
 * @param {string} input.businessType
 * @param {string} [input.businessName]
 * @param {string} [input.audience]
 * @param {string} [input.primaryGoal] purchase|booking|portfolio|lead|inform
 * @param {string} [input.brandCharacter]
 * @param {string[]} [input.contentPriority]
 * @param {Array<object>} [input.history] prior concepts to avoid repeating
 */
export function createDesignConcept(input = {}) {
  const businessType = String(input.businessType ?? "").trim();
  if (!businessType) throw new TypeError("businessType is required");

  const businessName = String(input.businessName ?? "").trim();
  const audience = String(input.audience ?? "Не указана; требуется уточнение на этапе контентного брифа").trim();
  const primaryGoal = input.primaryGoal ?? "lead";
  const allowedGoals = new Set(["purchase", "booking", "portfolio", "lead", "inform"]);
  if (!allowedGoals.has(primaryGoal)) throw new TypeError("primaryGoal must be purchase, booking, portfolio, lead, or inform");

  const contentPriority = Array.isArray(input.contentPriority) ? input.contentPriority.map(String) : [];
  const corpus = normalize([businessType, businessName, audience, input.brandCharacter ?? "", ...contentPriority].join(" "));
  const { primary, secondary, ranked } = chooseArchetypes(corpus, primaryGoal, input.history ?? []);
  const palette = pick(PALETTES, businessType + businessName + primary.id + "palette");
  const typography = TYPOGRAPHY[primary.type];
  const sections = sectionOrder(primary, corpus);
  const visualDirection = directionFor(primary, corpus);
  const signature = [primary.id, primary.hero, primary.visual, typography.character, palette.id].join("|");

  return {
    schemaVersion: "1.0.0",
    designBrief: {
      businessType,
      businessName: businessName || null,
      audience,
      primaryGoal,
      brandCharacter: String(input.brandCharacter ?? "Определить по позиционированию бренда"),
      contentPriority
    },
    designDNA: {
      primaryArchetype: primary.id,
      primaryArchetypeLabel: primary.label,
      secondaryArchetype: secondary?.id ?? null,
      selectionRationale: `Архетип выбран по совпадению ниши, аудитории, контентных приоритетов и цели «${primaryGoal}». Результат эвристический и требует проверки человеком.`,
      colorDirection: palette.label,
      palette: { background: palette.background, surface: palette.surface, text: palette.text, muted: palette.muted, accent: palette.accent },
      typographyDirection: typography.character,
      typography: { display: typography.display, body: typography.body },
      imageDirection: visualDirection,
      motionDirection: motionFor(primary),
      visualDirection: primary.visual
    },
    homepage: {
      heroComposition: primary.hero,
      navigationPattern: NAVIGATION[primary.id],
      sectionOrder: sections,
      primaryCTA: primaryGoal === "purchase" ? "Перейти к выбору товара" : primaryGoal === "booking" ? "Записаться" : primaryGoal === "portfolio" ? "Посмотреть работы" : primaryGoal === "inform" ? "Узнать подробнее" : "Оставить заявку"
    },
    uniquenessCheck: {
      templateReuseDetected: false,
      repeatedPatterns: [],
      differentiationActions: (input.history ?? []).length
        ? ["Сравнить композицию hero с последними проектами", "Не повторять визуальное направление без обоснования", "Проверить палитру и типографическую иерархию на реальном макете"]
        : ["Сохранить эту концепцию как базовую точку сравнения для следующих проектов"],
      similarityWarnings: ranked.filter(item => item.id !== primary.id && item.finalScore >= primary.finalScore - 1).slice(0, 2).map(item => item.id)
    },
    metadata: {
      engine: "heuristic-design-director",
      signature,
      confidence: primary.relevance >= 8 ? "high" : primary.relevance >= 4 ? "medium" : "low",
      requiresHumanReview: true
    }
  };
}

export const DESIGN_ARCHETYPES = ARCHETYPES.map(({ id, label, hero, visual }) => ({ id, label, hero, visual }));

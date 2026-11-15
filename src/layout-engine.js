const SECTION_COMPONENTS = {
  "hero-product":"product-hero",\n  "category-hero":"product-hero",\n  "delivery":"delivery-panel",\n  "catalog-cta":"conversion-banner",\n  "customer-reviews":"quote-editorial",\n  "pricing-details":"pricing-table",
  "featured-products":"product-showcase",
  "category-navigation":"category-rail",
  "category-grid":"category-bento",
  "popular-items":"product-grid",
  "selection-guide":"guided-selector",
  "benefits":"benefit-strip",
  "product-proof":"specification-proof",
  "delivery-and-payment":"delivery-panel",
  "purchase-cta":"conversion-banner",
  "editorial-hero":"editorial-cover",
  "selected-work":"editorial-gallery",
  "point-of-view":"manifesto-copy",
  "process":"process-timeline",
  "testimonials":"quote-editorial",
  "about":"profile-story",
  "contact":"contact-panel",
  "immersive-hero":"immersive-cover",
  "full-screen-gallery":"full-bleed-gallery",
  "project-stories":"story-cards",
  "services":"service-index",
  "about-artist":"artist-profile",
  "asymmetric-hero":"offset-hero",
  "capabilities":"capability-grid",
  "selected-cases":"case-study-stack",
  "approach":"approach-statement",
  "team-or-founder":"founder-profile",
  "split-hero":"split-action-hero",
  "service-selector":"service-selector",
  "how-it-works":"step-list",
  "results-or-cases":"results-gallery",
  "pricing":"pricing-table",
  "booking-form":"booking-form",
  "faq":"faq-accordion",
  "story-hero":"narrative-cover",
  "origin-story":"origin-story",
  "craft-or-process":"craft-process",
  "product-highlights":"feature-story",
  "social-proof":"social-proof",
  "visit-or-order":"visit-order-panel",
  "modular-hero":"bento-hero",
  "service-grid":"service-bento",
  "solutions-by-need":"solution-index",
  "proof-points":"proof-grid",
  "company-overview":"company-profile",
  "statement-hero":"type-statement",
  "visual-manifesto":"graphic-manifesto",
  "featured-work":"framed-work-grid",
  "offerings":"offering-list",
  "press-or-proof":"press-strip",
  "direct-contact":"direct-contact",
  "focused-hero":"focused-conversion-hero",
  "key-benefit":"single-benefit",
  "proof":"trust-proof",
  "offer-details":"offer-details",
  "objection-handling":"objection-list",
  "single-cta":"single-action"
};

const ARCHETYPE_LAYOUTS = {
  "product-first": { shell:"product-led", hero:"media-copy-split", section:"wide-contained", columns:2 },
  catalog: { shell:"catalog-led", hero:"compact-search-first", section:"dense-grid", columns:4 },
  editorial: { shell:"editorial", hero:"overlap-editorial", section:"narrow-wide-alternation", columns:2 },
  immersive: { shell:"immersive", hero:"full-viewport-overlay", section:"full-bleed", columns:1 },
  asymmetric: { shell:"asymmetric", hero:"offset-overlap", section:"offset-modules", columns:3 },
  "split-utility": { shell:"service-tool", hero:"copy-action-split", section:"functional-panels", columns:2 },
  storytelling: { shell:"narrative", hero:"chapter-intro", section:"vertical-story", columns:1 },
  modular: { shell:"modular", hero:"bento-feature", section:"bento-grid", columns:3 },
  brutalist: { shell:"graphic", hero:"type-wall", section:"hard-frame-grid", columns:2 },
  minimal: { shell:"focused", hero:"single-column", section:"narrow-stack", columns:1 }
};

const RESPONSIVE_RULES = {
  "product-led": { tablet:"2-column", mobile:"single-column; product media before copy; sticky purchase action only when useful" },
  "catalog-led": { tablet:"3-column", mobile:"2-column product grid; filters become an accessible disclosure" },
  editorial: { tablet:"2-column", mobile:"single-column; preserve editorial reading order" },
  immersive: { tablet:"full-bleed", mobile:"viewport-height with safe-area padding; overlay controls remain reachable" },
  asymmetric: { tablet:"offset-2-column", mobile:"single-column; remove overlap that obscures content" },
  "service-tool": { tablet:"copy-action split", mobile:"single-column; action panel follows the offer" },
  narrative: { tablet:"single-column", mobile:"single-column; chapter index becomes a compact contents list" },
  modular: { tablet:"2-column bento", mobile:"single-column with featured module first" },
  graphic: { tablet:"2-column", mobile:"single-column; scale display type with clamp and prevent overflow" },
  focused: { tablet:"narrow single-column", mobile:"single-column; keep primary action visible without covering content" }
};

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-|-$/g, "");
}

function archetypeOf(concept, identity, input) {
  return input?.archetype || identity?.archetype || concept?.designDNA?.primaryArchetype || concept?.primaryArchetype || "minimal";
}

function resolveComponent(section) {
  return SECTION_COMPONENTS[section] || "content-section";
}

/**
 * Convert a Design Director concept into an implementation-ready responsive page plan.
 * This is a structural blueprint; it does not fabricate business copy or imagery.
 */
export function createLayoutPlan(input = {}) {
  const concept = input.concept ?? input;
  const identity = input.visualIdentity ?? input.identity ?? null;
  const archetype = archetypeOf(concept, identity, input);
  const layout = ARCHETYPE_LAYOUTS[archetype] ?? ARCHETYPE_LAYOUTS.minimal;
  const sections = input.sections ?? concept?.homepage?.sectionOrder;
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new TypeError("A non-empty sections array or concept.homepage.sectionOrder is required");
  }

  const seen = new Set();
  const normalizedSections = sections.map((section, index) => {
    const id = typeof section === "string" ? section : section.id;
    if (!id || typeof id !== "string") throw new TypeError(`Section at index ${index} must have a string id`);
    if (seen.has(id)) throw new TypeError(`Duplicate section id: ${id}`);
    seen.add(id);
    const supplied = typeof section === "string" ? {} : section;
    return {
      id,
      key: slug(id),
      component: supplied.component || resolveComponent(id),
      title: supplied.title || null,
      content: supplied.content ?? null,
      priority: supplied.priority || (index === 0 ? "primary" : "normal"),
      desktop: supplied.desktop || (index === 0 ? layout.hero : layout.section),
      mobile: supplied.mobile || "single-column",
      order: index + 1
    };
  });

  const breakpoints = { mobile:0, tablet:768, desktop:1100, wide:1440 };
  const visual = identity?.cssVariables ?? {};
  const plan = {
    schemaVersion:"1.0.0",
    archetype,
    shell:layout.shell,
    composition:{ hero:layout.hero, sectionPattern:layout.section, defaultColumns:layout.columns },
    sections:normalizedSections,
    responsive:{
      breakpoints,
      tablet:RESPONSIVE_RULES[layout.shell]?.tablet ?? "2-column",
      mobile:RESPONSIVE_RULES[layout.shell]?.mobile ?? "single-column",
      overflowPolicy:"No horizontal page overflow; media uses max-width:100%; controls retain touch targets of at least 44px"
    },
    accessibility:{
      landmarks:["header","nav","main","footer"],
      headingOrder:"One h1 per page; section headings descend without skipped levels",
      keyboard:"All interactive controls keyboard reachable with visible focus",
      motion:"Respect prefers-reduced-motion",
      images:"Meaningful alt text for informative images; empty alt for decorative images"
    },
    cssVariables:{ ...visual },
    metadata:{
      sectionCount:normalizedSections.length,
      hasUnknownComponents:normalizedSections.some(section => section.component === "content-section"),
      humanReviewRequired:true
    }
  };
  return plan;
}

/** Produce baseline responsive CSS from a layout plan and its visual tokens. */
export function renderLayoutCss(plan) {
  if (!plan || !Array.isArray(plan.sections)) throw new TypeError("A valid layout plan is required");
  const variables = Object.entries(plan.cssVariables ?? {})
    .filter(([key,value]) => /^--[a-z0-9-]+$/i.test(key) && typeof value === "string" && !/[;{}]/.test(value))
    .map(([key,value]) => `  ${key}: ${value};`)
    .join("\n");
  const rules = plan.sections.map(section => {
    const selector = `.uds-section--${section.key}`;
    return `${selector} { grid-area: ${section.key}; min-width: 0; }\n${selector} img, ${selector} video { max-width: 100%; height: auto; }`;
  }).join("\n\n");
  return `:root {\n${variables}\n  --uds-layout-max: 1440px;\n  --uds-layout-gutter: clamp(20px, 5vw, 80px);\n}\n\n.uds-page { width: min(100%, var(--uds-layout-max)); margin-inline: auto; padding-inline: var(--uds-layout-gutter); }\n.uds-main { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: clamp(24px, 4vw, 64px); }\n\n${rules}\n\n@media (max-width: 767px) {\n  .uds-page { padding-inline: 20px; }\n  .uds-main { display: block; }\n  .uds-section { min-width: 0; }\n  .uds-section img, .uds-section video { width: 100%; object-fit: cover; }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }\n}\n`;
}

export const LAYOUT_ARCHETYPES = Object.keys(ARCHETYPE_LAYOUTS);

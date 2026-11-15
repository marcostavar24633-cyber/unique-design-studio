const PALETTE_FAMILIES = {
  product: [
    { id:"porcelain-ink", name:"Porcelain & Ink", background:"#F4F3EF", surface:"#FFFFFF", text:"#202329", muted:"#737982", accent:"#315B78", accentSoft:"#E2EBF0", mode:"light" },
    { id:"carbon-lime", name:"Carbon & Lime", background:"#171A19", surface:"#242927", text:"#F2F4EF", muted:"#A4ADA5", accent:"#C7E36B", accentSoft:"#343E2B", mode:"dark" },
    { id:"technical-blue", name:"Technical Blue", background:"#EAF0F5", surface:"#F8FBFD", text:"#142B40", muted:"#63798B", accent:"#1769AA", accentSoft:"#D8E8F5", mode:"light" }
  ],
  editorial: [
    { id:"ivory-oxblood", name:"Ivory & Oxblood", background:"#F2EBDD", surface:"#FAF6ED", text:"#2C2422", muted:"#82736D", accent:"#813D42", accentSoft:"#E9D9D5", mode:"light" },
    { id:"gallery-noir", name:"Gallery Noir", background:"#171615", surface:"#242220", text:"#F3EEE7", muted:"#AAA198", accent:"#D1B48C", accentSoft:"#3A3026", mode:"dark" },
    { id:"sage-paper", name:"Sage Paper", background:"#E9EDE5", surface:"#F8F9F4", text:"#27332C", muted:"#738075", accent:"#58765E", accentSoft:"#D9E4D8", mode:"light" }
  ],
  immersive: [
    { id:"midnight-cinema", name:"Midnight Cinema", background:"#10131B", surface:"#1B202B", text:"#F5F4F0", muted:"#A6ABB6", accent:"#E0A56A", accentSoft:"#342B25", mode:"dark" },
    { id:"warm-gallery", name:"Warm Gallery", background:"#EDE7DE", surface:"#F8F4ED", text:"#27231F", muted:"#82786D", accent:"#A65E3E", accentSoft:"#E8D8CB", mode:"light" },
    { id:"deep-ocean", name:"Deep Ocean", background:"#101F2A", surface:"#1A303D", text:"#EFF5F4", muted:"#A0B7BC", accent:"#69C3C2", accentSoft:"#24434A", mode:"dark" }
  ],
  expressive: [
    { id:"electric-paper", name:"Electric Paper", background:"#F0EFF8", surface:"#FFFFFF", text:"#211D35", muted:"#77718C", accent:"#6547E8", accentSoft:"#E2DDFB", mode:"light" },
    { id:"signal-red", name:"Signal Red", background:"#F1EEE8", surface:"#FAF8F3", text:"#171717", muted:"#77736D", accent:"#D6382D", accentSoft:"#F5DAD5", mode:"light" },
    { id:"acid-black", name:"Acid Black", background:"#141414", surface:"#242424", text:"#F5F5F0", muted:"#A5A59D", accent:"#D8F34A", accentSoft:"#343B1D", mode:"dark" }
  ],
  warm: [
    { id:"terracotta-cream", name:"Terracotta & Cream", background:"#F1E6D8", surface:"#FCF5EB", text:"#382A24", muted:"#89766A", accent:"#B45D3B", accentSoft:"#EBD5C7", mode:"light" },
    { id:"cocoa-rose", name:"Cocoa & Rose", background:"#28201F", surface:"#382C2B", text:"#F6ECE8", muted:"#C1AAA4", accent:"#D58C8D", accentSoft:"#493334", mode:"dark" },
    { id:"citrus-market", name:"Citrus Market", background:"#F1F0DF", surface:"#FBFBEF", text:"#292D1D", muted:"#777B62", accent:"#A4A72C", accentSoft:"#E4E7C5", mode:"light" }
  ],
  neutral: [
    { id:"stone-monochrome", name:"Stone Monochrome", background:"#ECEBE8", surface:"#F8F7F4", text:"#252525", muted:"#777570", accent:"#595959", accentSoft:"#DEDDDA", mode:"light" },
    { id:"soft-lilac", name:"Soft Lilac", background:"#EFEBF2", surface:"#FAF8FB", text:"#2B2530", muted:"#807584", accent:"#80618F", accentSoft:"#E5DCEA", mode:"light" },
    { id:"forest-night", name:"Forest Night", background:"#17211C", surface:"#243129", text:"#EFF4EE", muted:"#A7B3A8", accent:"#9CCB85", accentSoft:"#344638", mode:"dark" }
  ]
};

const TYPOGRAPHY = {
  "product-first": [
    { display:"Manrope", body:"Inter", scale:"compact", weight:750, tracking:"-0.045em" },
    { display:"Space Grotesk", body:"DM Sans", scale:"bold", weight:700, tracking:"-0.055em" },
    { display:"IBM Plex Sans", body:"IBM Plex Sans", scale:"technical", weight:650, tracking:"-0.03em" }
  ],
  editorial: [
    { display:"Cormorant Garamond", body:"Manrope", scale:"editorial", weight:600, tracking:"-0.035em" },
    { display:"Playfair Display", body:"Source Sans 3", scale:"contrast", weight:650, tracking:"-0.04em" },
    { display:"DM Serif Display", body:"DM Sans", scale:"expressive", weight:500, tracking:"-0.025em" }
  ],
  immersive: [
    { display:"Space Grotesk", body:"Inter", scale:"cinematic", weight:700, tracking:"-0.05em" },
    { display:"Bodoni Moda", body:"Manrope", scale:"luxury", weight:500, tracking:"-0.035em" },
    { display:"Archivo", body:"Inter", scale:"bold", weight:750, tracking:"-0.045em" }
  ],
  expressive: [
    { display:"Archivo Black", body:"DM Sans", scale:"poster", weight:800, tracking:"-0.06em" },
    { display:"Space Grotesk", body:"IBM Plex Mono", scale:"technical", weight:700, tracking:"-0.05em" },
    { display:"Syne", body:"DM Sans", scale:"experimental", weight:750, tracking:"-0.055em" }
  ],
  warm: [
    { display:"Fraunces", body:"Manrope", scale:"soft-display", weight:650, tracking:"-0.035em" },
    { display:"DM Sans", body:"Source Sans 3", scale:"friendly", weight:700, tracking:"-0.04em" },
    { display:"Lora", body:"Nunito Sans", scale:"human", weight:600, tracking:"-0.025em" }
  ],
  neutral: [
    { display:"Inter", body:"Inter", scale:"quiet", weight:650, tracking:"-0.04em" },
    { display:"Plus Jakarta Sans", body:"Inter", scale:"modern", weight:700, tracking:"-0.045em" },
    { display:"Geist", body:"Geist", scale:"precise", weight:650, tracking:"-0.04em" }
  ]
};

const SHAPES = [
  { id:"soft-geometry", radius:{ small:"10px", medium:"18px", large:"28px", pill:"999px" }, button:"rounded-rectangle", card:"soft-edge", line:"subtle" },
  { id:"hard-editorial", radius:{ small:"0px", medium:"0px", large:"2px", pill:"0px" }, button:"square", card:"ruled-panel", line:"strong" },
  { id:"organic", radius:{ small:"14px", medium:"24px", large:"38px", pill:"999px" }, button:"capsule", card:"organic-soft", line:"none" },
  { id:"technical", radius:{ small:"4px", medium:"8px", large:"12px", pill:"4px" }, button:"precision-rectangle", card:"outlined-panel", line:"technical" },
  { id:"brutal", radius:{ small:"0px", medium:"0px", large:"0px", pill:"0px" }, button:"block", card:"hard-frame", line:"heavy" }
];

const LAYOUTS = {
  "product-first": { grid:"12-column-product", density:"balanced", hero:"product-stage", imageRatio:"4:5", cardLayout:"comparison-cards", alignment:"left" },
  catalog: { grid:"12-column-catalog", density:"dense", hero:"category-led", imageRatio:"1:1", cardLayout:"catalog-grid", alignment:"left" },
  editorial: { grid:"asymmetric-editorial", density:"airy", hero:"editorial-cover", imageRatio:"3:4", cardLayout:"editorial-columns", alignment:"mixed" },
  immersive: { grid:"full-bleed-canvas", density:"minimal", hero:"immersive-image", imageRatio:"16:9", cardLayout:"overlay-stories", alignment:"bottom-left" },
  asymmetric: { grid:"offset-12-column", density:"airy", hero:"offset-composition", imageRatio:"5:6", cardLayout:"overlap-modules", alignment:"asymmetric" },
  "split-utility": { grid:"split-functional", density:"balanced", hero:"action-panel", imageRatio:"4:3", cardLayout:"service-selector", alignment:"split" },
  storytelling: { grid:"narrative-column", density:"airy", hero:"chapter-intro", imageRatio:"3:2", cardLayout:"story-sequence", alignment:"left" },
  modular: { grid:"bento-modular", density:"balanced", hero:"bento-entry", imageRatio:"1:1", cardLayout:"bento-cards", alignment:"modular" },
  brutalist: { grid:"poster-grid", density:"bold", hero:"type-wall", imageRatio:"4:5", cardLayout:"framed-blocks", alignment:"hard-left" },
  minimal: { grid:"single-column-focus", density:"minimal", hero:"focused-offer", imageRatio:"16:9", cardLayout:"simple-list", alignment:"center" }
};

const ARCHETYPE_FAMILY = {
  "product-first":"product", catalog:"product",
  editorial:"editorial",
  immersive:"immersive",
  asymmetric:"expressive", brutalist:"expressive",
  "split-utility":"warm", storytelling:"warm",
  modular:"neutral", minimal:"neutral"
};

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choose(items, seed) {
  return items[stableHash(seed) % items.length];
}

function getArchetype(concept, input) {
  return input.archetype
    || concept?.designDNA?.primaryArchetype
    || concept?.primaryArchetype
    || "minimal";
}

/**
 * Generate a complete visual identity layer from a Design Director concept.
 * The output is deterministic for a given project identity and supports explicit overrides.
 */
export function createVisualIdentity(input = {}) {
  const concept = input.concept ?? input;
  const businessType = String(input.businessType ?? concept?.designBrief?.businessType ?? "business").trim();
  const businessName = String(input.businessName ?? concept?.designBrief?.businessName ?? "").trim();
  const archetype = getArchetype(concept, input);
  const family = ARCHETYPE_FAMILY[archetype] ?? "neutral";
  const seed = [businessType, businessName, archetype, input.identitySeed ?? ""].join("|");
  const palette = input.paletteId
    ? Object.values(PALETTE_FAMILIES).flat().find(item => item.id === input.paletteId)
    : choose(PALETTE_FAMILIES[family], seed + "|palette");
  if (!palette) throw new TypeError("Unknown paletteId");

  const typographyOptions = TYPOGRAPHY[archetype] ?? TYPOGRAPHY.neutral;
  const typography = choose(typographyOptions, seed + "|type");
  const shape = input.shapeId
    ? SHAPES.find(item => item.id === input.shapeId)
    : choose(SHAPES.filter(item => archetype === "brutalist" ? item.id === "brutal" || item.id === "hard-editorial" : item.id !== "brutal"), seed + "|shape");
  if (!shape) throw new TypeError("Unknown shapeId");

  const layout = { ...(LAYOUTS[archetype] ?? LAYOUTS.minimal) };
  const spacing = layout.density === "airy"
    ? { section:"clamp(88px, 12vw, 168px)", content:"clamp(24px, 5vw, 72px)", element:"24px" }
    : layout.density === "dense"
      ? { section:"clamp(44px, 6vw, 80px)", content:"clamp(16px, 3vw, 36px)", element:"14px" }
      : { section:"clamp(64px, 8vw, 112px)", content:"clamp(20px, 4vw, 52px)", element:"20px" };

  const graphicStyle = {
    editorial:"fine rules, oversized type, restrained image captions",
    immersive:"cinematic crops, deep overlays, atmospheric gradients",
    expressive:"bold framing, oversized labels, graphic contrast",
    warm:"tactile surfaces, warm image treatment, subtle organic details",
    product:"precise product framing, clear specification labels, restrained decoration",
    neutral:"quiet geometry, clear hierarchy, minimal ornament"
  }[family];

  const identity = {
    schemaVersion:"1.0.0",
    source:"unique-design-studio.visual-identity",
    archetype,
    palette: { ...palette },
    typography: {
      ...typography,
      headingScale: typography.scale === "editorial" || typography.scale === "luxury" ? "clamp(3rem, 8vw, 7.5rem)" : "clamp(2.5rem, 6vw, 6rem)",
      bodySize:"clamp(1rem, 1.2vw, 1.125rem)"
    },
    geometry: {
      ...shape,
      radius:{ ...shape.radius }
    },
    layout,
    spacing,
    graphics: {
      style:graphicStyle,
      iconStyle: family === "technical" ? "outlined-technical" : family === "expressive" ? "bold-geometric" : "minimal-line",
      imageTreatment:family === "immersive" ? "cinematic" : family === "warm" ? "warm-natural" : family === "editorial" ? "art-directed" : "neutral-authentic",
      texture:family === "editorial" ? "paper-grain-subtle" : family === "expressive" ? "graphic-grid" : family === "warm" ? "soft-organic" : "none"
    },
    interaction: {
      buttonFeedback:archetype === "catalog" || archetype === "product-first" ? "fast-press-and-focus" : "subtle-hover-and-focus",
      cardFeedback:archetype === "immersive" ? "image-reveal" : archetype === "brutalist" ? "hard-offset" : "lift-and-border",
      motion:concept?.designDNA?.motionDirection ?? "short purposeful transitions; respect prefers-reduced-motion",
      reducedMotionRequired:true
    },
    cssVariables: {
      "--uds-color-bg":palette.background,
      "--uds-color-surface":palette.surface,
      "--uds-color-text":palette.text,
      "--uds-color-muted":palette.muted,
      "--uds-color-accent":palette.accent,
      "--uds-color-accent-soft":palette.accentSoft,
      "--uds-radius-sm":shape.radius.small,
      "--uds-radius-md":shape.radius.medium,
      "--uds-radius-lg":shape.radius.large,
      "--uds-radius-pill":shape.radius.pill,
      "--uds-space-section":spacing.section,
      "--uds-space-content":spacing.content,
      "--uds-space-element":spacing.element,
      "--uds-font-display":'"' + typography.display + '", sans-serif',
      "--uds-font-body":'"' + typography.body + '", sans-serif'
    },
    metadata: {
      signature:[archetype,palette.id,typography.display,shape.id,layout.grid].join("|"),
      deterministic:true,
      humanReviewRecommended:true
    }
  };

  if (input.overrides && typeof input.overrides === "object") {
    if (input.overrides.paletteId) {
      const override = Object.values(PALETTE_FAMILIES).flat().find(item => item.id === input.overrides.paletteId);
      if (!override) throw new TypeError("Unknown overrides.paletteId");
      identity.palette = { ...override };
      identity.cssVariables["--uds-color-bg"] = override.background;
      identity.cssVariables["--uds-color-surface"] = override.surface;
      identity.cssVariables["--uds-color-text"] = override.text;
      identity.cssVariables["--uds-color-muted"] = override.muted;
      identity.cssVariables["--uds-color-accent"] = override.accent;
      identity.cssVariables["--uds-color-accent-soft"] = override.accentSoft;
    }
  }

  return identity;
}

export function listVisualIdentityOptions() {
  return {
    palettes:Object.values(PALETTE_FAMILIES).flat().map(({ id, name, mode }) => ({ id, name, mode })),
    shapes:SHAPES.map(({ id, button, card }) => ({ id, button, card })),
    archetypes:Object.keys(LAYOUTS)
  };
}

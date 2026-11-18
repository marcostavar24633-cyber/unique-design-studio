// Публичный API движка Unique Design Studio.
import { buildConcept, registryEntry, upsertRegistry } from './concept.js';
import { renderSite } from './render.js';
import { auditSite } from './audit.js';
import { exportProject, normalizeProject } from './project.js';

export { buildConcept, buildBrandPalette, buildPalette, detectNiche, fingerprintOf, registryEntry, similarity, upsertRegistry } from './concept.js';
export { renderSite, renderCss } from './render.js';
export { auditSite } from './audit.js';
export { buildPrompt, withCustomPrompt } from './prompt.js';
export { autopilot, buildSpec, draftFromNiche, fromAiLanding } from './autopilot.js';
export { exportProject, normalizeProject, resolveArchitecture, tierOf, FORMAT_VERSION, TIERS } from './project.js';
export { ARCHETYPES, ARCHETYPE_IDS, DIRECTIONS, LEGACY_FAMILIES, LEGACY_LABELS, NAV_LABELS, NICHES, TYPES, SHAPES, WEB_FONTS } from './data.js';
export { contrast } from './color.js';
export { LIBRARY_KEY, normalizeLibrary, referencesFor } from './library.js';
export { analyzePage, buildProfile, stylesheetLinks, headingType } from './site-analysis.js';
export { runMarketIntelligence, MARKET_INTELLIGENCE_LIMIT } from './market-intelligence.js';
export { reviewDesign, applyApprovedDesignPatch, DESIGN_DIRECTOR_APPROVABLE_FIELDS } from './design-director.js';
export { qualityReport, applyAutoFixes, fixAndRecheck, CATEGORIES as QUALITY_CATEGORIES, SEVERITIES, SEVERITY_LABELS } from './quality.js';
export { runWorkflow, WORKFLOW_STAGES } from './workflow.js';
export { imageSlots, slotBrief, imageTaskPackage, reviewImageSet } from './image-director.js';

/** Полный цикл: проект → концепция → HTML → аудит → запись реестра → JSON для экспорта. */
export function generate(input, { registry = [], neighbors = 2 } = {}) {
  const project = normalizeProject(input);
  const concept = buildConcept(project, { registry, neighbors });
  const html = renderSite(project, concept);
  const audit = auditSite(html, concept, project);
  const entry = registryEntry(project, concept);
  return { project, concept, html, audit, entry, registry: upsertRegistry(registry, entry), exported: exportProject(project, concept) };
}
export { BRANDS } from './brands.js';
export { nicheVisual, itemSubject, photoPrompt, translit } from './photo-brief.js';
export { MECHANICS, chooseMechanic } from './mechanics.js';
export { MASKS, DIVIDERS, chooseForms } from './forms.js';
export { TEXT_EFFECTS, chooseTextEffect } from './text-effects.js';
export { WEB_FONT_PAIRS } from './data.js';
export { GRAPHIC_DIRECTIONS, chooseGraphicDirection } from './graphic-art-direction.js';

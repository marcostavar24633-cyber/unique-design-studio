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
export { analyzePage, buildProfile, stylesheetLinks } from './site-analysis.js';
export { CATEGORIES, LIBRARY_KEY, PROFILE_FIELDS, PROFILE_GROUPS, matchTemplates, normalizeLibrary, normalizeReferences, normalizeTemplate, referencesFor } from './library.js';
export { conceptIdentity, contextSignals } from './context.js';

/** Полный цикл: проект → концепция → HTML → аудит → запись реестра → JSON для экспорта. */
export function generate(input, { registry = [], neighbors = 2, references } = {}) {
  const project = normalizeProject(input);
  const concept = buildConcept(project, { registry, neighbors, references });
  const html = renderSite(project, concept);
  const audit = auditSite(html, concept, project);
  const entry = registryEntry(project, concept);
  return { project, concept, html, audit, entry, registry: upsertRegistry(registry, entry), exported: exportProject(project, concept) };
}
export { BRANDS } from './brands.js';

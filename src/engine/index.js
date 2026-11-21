// Публичный API движка Unique Design Studio.
import { buildConcept, registryEntry, upsertRegistry } from './concept.js';
import { renderSite } from './render.js';
import { auditSite } from './audit.js';
import { exportProject, normalizeProject } from './project.js';

export { applyManualOrder, buildConcept, buildBrandPalette, buildPalette, detectNiche, fingerprintOf, registryEntry, similarity, upsertRegistry } from './concept.js';
export { renderSite, renderCss } from './render.js';
export { auditSite } from './audit.js';
export { buildPrompt, withCustomPrompt } from './prompt.js';
export { PROMPT_MANAGER_KEY, PROMPT_MODULES, PROMPT_LIMITS, emptyPromptRegistry, normalizePromptRegistry, loadPromptRegistry, savePromptRegistry, activePrompt, savePromptVersion, activatePromptVersion, applyManagedPrompt, exportPromptRegistry, importPromptRegistry } from './prompt-manager.js';
export { autopilot, buildSpec, draftFromNiche, fromAiLanding } from './autopilot.js';
export { exportProject, normalizeProject, resolveArchitecture, tierOf, FORMAT_VERSION, TIERS } from './project.js';
export { ARCHETYPES, ARCHETYPE_IDS, DIRECTIONS, LEGACY_FAMILIES, LEGACY_LABELS, NAV_LABELS, NICHES, TYPES, SHAPES, WEB_FONTS } from './data.js';
export { contrast } from './color.js';
export { LIBRARY_KEY, normalizeLibrary, referencesFor } from './library.js';
export { analyzePage, buildProfile, stylesheetLinks, headingType } from './site-analysis.js';
export { runMarketIntelligence, MARKET_INTELLIGENCE_LIMIT } from './market-intelligence.js';
export { reviewDesign, applyApprovedDesignPatch, DESIGN_DIRECTOR_APPROVABLE_FIELDS } from './design-director.js';
export { prepareContentIntelligence, reviewGeneratedContent, CONTENT_INTELLIGENCE_MODULES } from './content-intelligence.js';
export { qualityReport, applyAutoFixes, fixAndRecheck, CATEGORIES as QUALITY_CATEGORIES, SEVERITIES, SEVERITY_LABELS } from './quality.js';
export { runWorkflow, WORKFLOW_STAGES } from './workflow.js';
export { GALLERY_FRAMES, imageSlots, slotBrief, imageTaskPackage, reviewImageSet } from './image-director.js';
export { createVisualIdentity, listVisualIdentityOptions } from '../visual-identity.js';

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
export { WEB_FONT_PAIRS, BUTTONS } from './data.js';
export { GRAPHIC_DIRECTIONS, chooseGraphicDirection } from './graphic-art-direction.js';
export { CINEMATIC_PRESETS, CINEMATIC_PRESET_IDS, chooseCinematicLayers, describeCinematicLayers } from './cinematic/visual-layers.js';
export { TRANSITIONS, TRANSITION_IDS, TRANSITION_LIMITS, chooseTransition, describeTransition } from './cinematic/transitions.js';
export { CARD_SHAPES, CARD_SHAPE_IDS, REVEALS, REVEAL_IDS, chooseVariety } from './variety.js';
export { CARD_EFFECTS, CARD_EFFECT_IDS, HERO_EFFECTS, HERO_EFFECT_IDS, chooseEffects, describeEffects } from './effects.js';
export { TYPE_STYLES, TYPE_STYLE_IDS, SECTION_LAYOUTS, SECTION_LAYOUT_IDS, TEXT_ANIMATIONS, BUTTON_ANIMATIONS, BUTTON_ANIMATION_IDS, chooseTypography } from './typography-layout.js';
export { directScene } from './cinematic/scene-director.js';
export { SCENE_PROFILES } from './cinematic/scene-profiles.js';

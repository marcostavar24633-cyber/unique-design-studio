import { SCENE_PROFILES } from './scene-profiles.js';

const GRAPHIC_HINTS = /кинематограф|cinematic|атмосфер|макрофактур|свет|арт-фотограф/i;

/** Выбирает один профиль Hero по нише, классу, архитектуре и направлению графики. */
export function directScene(concept, project = {}) {
  const vs = concept?.visualSystem || {};
  const niche = String(vs.nicheId || '').toLowerCase();
  const archetype = String(vs.archetype || 'editorial');
  const tier = project.tier || 'standard';
  const graphic = vs.graphicDirection || {};
  const graphicText = [graphic.label, graphic.ru, graphic.rationale].filter(Boolean).join(' ');
  let type;
  if (tier === 'luxury') type = 'luxury-cinematic';
  else if (project.images?.hero || project.gallery?.length || graphic.id === 'cinematic-photo') type = 'living-photography';
  else if (GRAPHIC_HINTS.test(graphicText) || ['immersive', 'storytelling'].includes(archetype)) type = 'immersive-environment';
  else if (['editorial', 'asymmetric', 'brutalist'].includes(archetype)) type = 'editorial-motion';
  else if (['music', 'events', 'fitness', 'underground'].includes(niche)) type = 'particle-universe';
  else if (['catalog', 'product-first', 'modular-grid'].includes(archetype)) type = 'clean-product';
  else type = 'immersive-environment';

  const profile = SCENE_PROFILES[type];
  const reduced = vs.motionPlan?.intensity === 'calm';
  return Object.freeze({
    type, label: profile.label, layers: profile.layers,
    intensity: reduced ? 'calm' : (vs.motionPlan?.intensity || 'balanced'),
    depth: reduced ? 1 : 2,
    mobileFallback: true,
    motionEnabled: vs.motion !== 'static',
    hasPhotography: Boolean(project.images?.hero || project.gallery?.length),
    description: profile.description,
  });
}

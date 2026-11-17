// Design Brief → Design DNA → структура главной → антишаблонная проверка (§2–§9 спецификации).
import { ARCHETYPES, BUTTONS, DIRECTIONS, GENERIC_NICHE, LEGACY_FAMILIES, MOTION_LABELS, NAV_LABELS, NICHES, ROLES, SHAPES, TYPES, WEB_FONTS } from './data.js';
import { contrast, ensureContrast, hexToHsl, hslToHex, mix, readableOn, rgba } from './color.js';
import { normalizeProject } from './project.js';
import { BRAND_FONT_WEIGHTS, BRANDS } from './brands.js';
import { between, hash, pick, stream, uniq } from './util.js';
import { conceptIdentity, contextSignals } from './context.js';
import { SECTION_LABELS, normalizeReferences } from './library.js';
import { chooseMotion } from './motion.js';
import { commerceEnabled } from './commerce.js';
import { chooseMechanic } from './mechanics.js';
import { chooseForms } from './forms.js';

// ---------- Ниша ----------
export function detectNiche(project) {
  const niche = project.niche.toLowerCase();
  const rest = `${project.brand} ${project.description} ${project.mainOffer}`.toLowerCase();
  let best = null;
  for (const profile of NICHES) {
    const hit = kw => text => (kw instanceof RegExp ? kw.test(text) : text.includes(kw));
    const matched = profile.kw.filter(kw => hit(kw)(niche));
    const weak = profile.kw.filter(kw => !hit(kw)(niche) && hit(kw)(rest));
    const score = matched.length * 3 + weak.length;
    if (score > 0 && (!best || score > best.score)) best = { profile, score };
  }
  return best ? best.profile : GENERIC_NICHE;
}

function contentSignals(p) {
  return {
    items: p.services.length,
    prices: p.services.some(i => i.price),
    itemImages: p.services.filter(i => i.image).length,
    gallery: p.gallery.length,
    heroImage: Boolean(p.images.hero),
    form: Boolean(p.formAction || p.contacts.email),
    process: p.process.length,
    about: Boolean(p.aboutText),
    advantages: p.advantages.length,
    faqs: p.faqs.length,
    contacts: Boolean(p.contacts.phone || p.contacts.email || p.contacts.address),
  };
}

// ---------- Выбор архитектуры ----------
function rankArchetypes(project, profile, s, refs = []) {
  const score = Object.fromEntries(Object.keys(ARCHETYPES).map(id => [id, 0]));
  const reasons = Object.fromEntries(Object.keys(ARCHETYPES).map(id => [id, []]));
  const add = (id, n, why) => { score[id] += n; if (why) reasons[id].push(why); };
  [10, 7, 5, 3].forEach((n, i) => profile.candidates[i] && add(profile.candidates[i], n));
  if (s.items >= 6) { add('catalog', 4, `в проекте ${s.items} позиций — ассортимент нужно показать сразу`); add('product-first', 1); }
  if (s.prices) { add('product-first', 3, 'у позиций указаны цены — товар и покупка выносятся в центр'); add('catalog', 2); }
  if (s.gallery >= 3 || s.heroImage) { add('immersive', 3, 'есть сильный визуальный материал'); add('editorial', 1); }
  if (s.form) add('split-utility', 3, 'настроен приём заявок — инструмент действия можно вынести на первый экран');
  if (s.process >= 4 && s.about) add('storytelling', 2, 'есть история и этапы — материал для последовательного рассказа');
  if (!s.items && !s.gallery) add('minimal', 4, 'контента немного — лишние блоки только отвлекут от действия');
  // Класс проекта: премиум и люкс тяготеют к журнальной подаче, крупному визуалу и тишине вокруг предложения.
  if (project.tier === 'premium') { add('editorial', 3, 'премиум-класс — авторская журнальная подача'); add('immersive', 2); add('minimal', 1); }
  if (project.tier === 'luxury') {
    add('editorial', 5, 'люкс — редакционная подача, воздух и типографика вместо плотного каталога');
    add('immersive', 4, 'люкс — крупный визуал и атмосфера'); add('minimal', 3); add('asymmetric', 2);
    add('catalog', -3); add('product-first', -2); add('brutalist', -6); add('split-utility', -2);
  }
  // Контекст: характер бренда, аудитория и задача страницы — небольшие поправки к нишевой оценке.
  for (const sig of contextSignals(project)) add(sig.id, sig.n, sig.why);
  // Изученные сайты из библиотеки — это конкурентная среда: композицию их первого экрана не повторяем.
  for (const ref of refs) if (ref.traits.archetypes[0]) add(ref.traits.archetypes[0], -4);
  const arch = project.architecture;
  let ids = Object.keys(ARCHETYPES);
  if (arch.mode === 'family') ids = LEGACY_FAMILIES[arch.family];
  const ranked = ids.map((id, i) => ({ id, score: score[id], reasons: reasons[id], i }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  if (arch.mode === 'exact') return [{ id: arch.exact, score: 99, reasons: reasons[arch.exact] }, ...ranked.filter(r => r.id !== arch.exact)];
  return ranked;
}

// ---------- Палитра ----------
export function buildPalette(directionId, seed, { accent = '' } = {}) {
  const dir = DIRECTIONS[directionId];
  const r = stream(seed, `palette:${directionId}`);
  const [bh, bs, bl] = dir.bg.map(range => between(r, range));
  const dark = bl < 50;
  const bg = hslToHex(bh, bs, bl);
  const surface = dark ? hslToHex(bh, bs, bl + 5) : bl >= 97 ? hslToHex(bh, Math.min(bs + 4, 30), bl - 3.5) : hslToHex(bh, bs * 0.5, 99);
  const text = hslToHex(bh, Math.min(bs, 22), dark ? 93 : 11);
  let ac = accent || hslToHex(...dir.ac.map(range => between(r, range)));
  if (!accent) ac = ensureContrast(ac, bg, 3.1);
  return finishPalette(dark, bg, surface, text, mix(text, bg, 0.38), ac);
}

/** Фирменная палитра живого проекта (brands.js). Цвета бренда сохраняются,
 *  а текст и вторичный текст при необходимости подтягиваются до контраста WCAG. */
export function buildBrandPalette(brand, { accent = '' } = {}) {
  const dark = brand.mode === 'dark';
  let text = ensureContrast(brand.text, brand.bg, 7);
  text = ensureContrast(text, brand.surface, 4.6);
  return finishPalette(dark, brand.bg, brand.surface, text, brand.muted, accent || brand.accent);
}

function finishPalette(dark, bg, surface, text, mutedBase, ac) {
  let muted = ensureContrast(mutedBase, bg, 4.6);
  muted = ensureContrast(muted, surface, 4.6);
  let accentText = readableOn(ac, hslToHex(hexToHsl(ac)[0], 30, 8), '#ffffff');
  // На средних по светлоте акцентах тонированный тёмный не дотягивает до 4.5:1 — берём чистый чёрный или белый.
  if (contrast(accentText, ac) < 4.5) accentText = readableOn(ac, '#000000', '#ffffff');
  let accentInk = ensureContrast(ac, bg, 4.6);
  accentInk = ensureContrast(accentInk, surface, 4.6);
  const tint = mix(bg, ac, dark ? 0.16 : 0.1);
  return {
    mode: dark ? 'dark' : 'light', bg, surface, text, muted, accent: ac, accentText, accentInk, tint,
    border: rgba(text, dark ? 0.2 : 0.16), focus: accentInk,
    pairs: [
      ['текст / фон', text, bg], ['текст / поверхность', text, surface], ['вторичный текст / фон', muted, bg],
      ['вторичный текст / поверхность', muted, surface], ['текст кнопки / акцент', accentText, ac],
      ['акцентный текст / фон', accentInk, bg], ['текст / тонированная поверхность', text, tint],
    ].map(([name, fg, bgc]) => ({ name, fg, bg: bgc, ratio: Math.round(contrast(fg, bgc) * 100) / 100 })),
  };
}

// ---------- Композиция решения ----------
function compose(project, profile, ranked, seed, avoid) {
  const pool = ranked.filter(r => !avoid.archetypes.includes(r.id));
  const primary = (project.architecture.mode === 'exact' ? ranked[0] : pool[0] || ranked[0]).id;
  const arch = ARCHETYPES[primary];
  const secondaryPick = project.secondaryArchitecture && project.secondaryArchitecture !== primary
    ? project.secondaryArchitecture
    : (avoid.secondaryHint && avoid.secondaryHint !== primary ? avoid.secondaryHint : (ranked.find(r => r.id !== primary && r.score > 0) || {}).id) || '';
  const placement = pick(stream(seed, 'placement'), Object.keys(arch.placements), avoid.placements);
  // Премиум и люкс: контрастная дидона и старостильная антиква впереди нишевых характеров.
  const tierTypes = { premium: ['serif-editorial', 'didone-contrast', 'geometric-clean'], luxury: ['didone-contrast', 'serif-editorial'] }[project.tier];
  const tierPool = tierTypes ? tierTypes.filter(t => arch.types.includes(t)) : [];
  const typePool = tierPool.length ? tierPool : profile.types.filter(t => arch.types.includes(t));
  const typeCharacter = pick(stream(seed, 'type'), typePool.length ? typePool : arch.types, avoid.types);
  const nav = pick(stream(seed, 'nav'), arch.navs, avoid.navs);
  let dirPool = profile.directions;
  // Люкс: сдержанные «галерейные» и глубокие направления; тёмный фон с золотом по-прежнему не по умолчанию.
  if (project.tier === 'luxury') dirPool = ['gallery-white', 'gallery-black', 'aubergine', 'night-sky', 'warm-paper', 'chestnut'];
  if (project.tier === 'premium') dirPool = [...new Set([...profile.directions, 'gallery-white', 'aubergine', 'warm-paper'])];
  if (project.palette !== 'auto') {
    const byMode = dirPool.filter(d => DIRECTIONS[d].mode === project.palette);
    dirPool = byMode.length ? byMode : Object.keys(DIRECTIONS).filter(d => DIRECTIONS[d].mode === project.palette);
  }
  let direction;
  if (project.accent) {
    // Акцент задан в проекте: берём направление с ближайшим по тону акцентом, чтобы фон его поддерживал.
    const hue = hexToHsl(project.accent)[0];
    const dist = d => { const [a, b] = DIRECTIONS[d].ac[0]; const mid = (a + b) / 2; const x = Math.abs(hue - mid) % 360; return Math.min(x, 360 - x); };
    const sorted = [...dirPool].sort((a, b) => dist(a) - dist(b));
    direction = sorted.find(d => !avoid.directions.includes(d)) || sorted[0];
  } else direction = pick(stream(seed, 'direction'), dirPool, avoid.directions);
  const tierShapes = project.tier === 'luxury' ? arch.shapes.filter(x => x !== 'round') : arch.shapes;
  const shape = pick(stream(seed, 'shape'), tierShapes.length ? tierShapes : arch.shapes, avoid.shapes);
  const motif = pick(stream(seed, 'motif'), profile.motifs);
  const button = primary === 'brutalist' ? 'block'
    : project.tier === 'luxury' ? pick(stream(seed, 'button'), ['outline', 'underline'])
    : pick(stream(seed, 'button'), primary === 'editorial' || primary === 'storytelling' ? ['solid', 'outline', 'underline'] : ['solid', 'solid', 'outline']);
  // Вариант подачи секций — отдельная композиционная ось, а не только оформление hero.
  const sectionLayout = pick(stream(seed, 'section-layout'), ['editorial', 'offset', 'framed', 'quiet'], avoid.sectionLayouts || []);
  return { primary, secondary: secondaryPick, placement, typeCharacter, nav, direction, shape, motif, button, sectionLayout };
}

export const fingerprintOf = d => ({
  archetype: d.primary,
  placement: d.placement,
  typeCharacter: d.typeCharacter,
  nav: d.nav,
  colorDirection: d.direction,
  shape: d.shape,
  motif: d.motif,
  button: d.button,
  motion: ARCHETYPES[d.primary].motion,
  sectionLayout: d.sectionLayout || 'editorial',
});

const tripleEqual = (a, b) => a.archetype === b.archetype && a.placement === b.placement && a.typeCharacter === b.typeCharacter;

/** Доля совпавших признаков визуального характера (0…1) — для отчёта о похожести.
 *  Старые записи реестра без новых полей совместимы: отсутствующие признаки не учитываются. */
export function similarity(a, b) {
  const w = { archetype: 3, placement: 2, typeCharacter: 2, nav: 1, colorDirection: 1, shape: 1, motif: 1, button: 1, motion: 1, sectionLayout: 1, sectionOrder: 2 };
  let total = 0, same = 0;
  for (const [k, v] of Object.entries(w)) {
    if (a[k] == null || b[k] == null || a[k] === '' || b[k] === '') continue;
    total += v;
    if (a[k] === b[k]) same += v;
  }
  return total ? Math.round((same / total) * 100) / 100 : 0;
}

// ---------- Секции ----------
function sectionOrder(project, profile, arch, s, sectionLayout = 'editorial', seed = hash(project.id || project.brand)) {
  const has = {
    about: s.about, items: s.items > 0, advantages: s.advantages > 0, process: s.process > 0,
    gallery: s.gallery > 0, faq: s.faqs > 0, contact: true,
  };
  // Ведущие секции ниши сохраняют приоритет. Внутри выбранного ритма есть
  // два редакционных маршрута: порядок не сводится к одной схеме на всю нишу.
  const lead = uniq(profile.lead || []).filter(id => id !== 'contact' && has[id]);
  const base = uniq(arch.order).filter(id => id !== 'contact' && has[id] && !lead.includes(id));
  const preferences = {
    editorial: [
      ['about', 'gallery', 'items', 'advantages', 'process', 'faq'],
      ['gallery', 'about', 'advantages', 'items', 'process', 'faq'],
    ],
    offset: [
      ['gallery', 'advantages', 'about', 'items', 'faq', 'process'],
      ['advantages', 'gallery', 'items', 'about', 'process', 'faq'],
    ],
    framed: [
      ['items', 'advantages', 'process', 'gallery', 'about', 'faq'],
      ['process', 'items', 'gallery', 'advantages', 'about', 'faq'],
    ],
    quiet: [
      ['about', 'process', 'faq', 'advantages', 'items', 'gallery'],
      ['faq', 'about', 'advantages', 'process', 'gallery', 'items'],
    ],
  }[sectionLayout] || [['about', 'items', 'advantages', 'process', 'gallery', 'faq']];
  const preference = pick(stream(seed, 'section-order-variant'), preferences);
  const rank = id => { const i = preference.indexOf(id); return i < 0 ? preference.length : i; };
  const rest = base.map((id, index) => ({ id, index }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.index - b.index)
    .map(x => x.id);
  return [...lead, ...rest, 'contact'];
}

// ---------- Главная функция ----------
export function buildConcept(input, { registry = [], neighbors = 2, references } = {}) {
  const project = normalizeProject(input);
  const profile = detectNiche(project);
  const s = contentSignals(project);
  // Профили библиотеки шаблонов: из опции или из поля проекта designReferences (сохраняется в экспорте).
  const refs = normalizeReferences(references ?? project.passthrough.designReferences);
  const ranked = rankArchetypes(project, profile, s, refs);
  const seed = hash(`${project.brand}|${project.niche}`);
  const others = registry.filter(e => e && e.fingerprint && e.id !== project.id);
  const near = neighbors > 0 ? others.slice(-neighbors) : [];

  const avoid = { archetypes: [], placements: [], types: [], navs: [], directions: [], shapes: [], sectionLayouts: [] };
  // Фирменный характер источников не переносим: их типографику и форму элементов исключаем из выбора,
  // а их архитектуру используем только как вспомогательную — от неё берётся подача блоков, но не первый экран.
  for (const ref of refs) {
    if (ref.traits.typeCharacter) avoid.types.push(ref.traits.typeCharacter);
    if (ref.traits.shape) avoid.shapes.push(ref.traits.shape);
    if (!avoid.secondaryHint && ref.traits.archetypes[0]) avoid.secondaryHint = ref.traits.archetypes[0];
  }
  const repeated = [], actions = [];
  let design = compose(project, profile, ranked, seed, avoid);

  // Жёсткое правило §5: с соседними проектами нельзя одновременно повторять архитектуру hero,
  // расположение основного визуала и характер типографической иерархии.
  for (let guard = 0; guard < 8; guard++) {
    const fp = fingerprintOf(design);
    const clash = near.find(n => tripleEqual(fp, n.fingerprint));
    if (!clash) break;
    const who = clash.brand || clash.id;
    if (guard === 0 || !repeated.some(t => t.includes(who))) {
      repeated.push(`С проектом «${who}» совпали одновременно архитектура hero (${ARCHETYPES[fp.archetype].name}), расположение визуала и характер типографики`);
    }
    const before = design;
    const canSwitchArch = project.architecture.mode !== 'exact'
      && ranked.some(r => r.id !== fp.archetype && !avoid.archetypes.includes(r.id) && r.score > 0);
    if (canSwitchArch) avoid.archetypes.push(fp.archetype);
    else if (Object.keys(ARCHETYPES[fp.archetype].placements).some(k => k !== fp.placement && !avoid.placements.includes(k))) avoid.placements.push(fp.placement);
    else avoid.types.push(fp.typeCharacter);
    design = compose(project, profile, ranked, seed, avoid);
    if (design.primary !== before.primary) actions.push(`Пересобрана композиция: архитектура ${ARCHETYPES[before.primary].name} заменена на ${ARCHETYPES[design.primary].name}`);
    else if (design.placement !== before.placement) actions.push(`Изменено расположение основного визуала: «${ARCHETYPES[design.primary].placements[design.placement]}»`);
    else if (design.typeCharacter !== before.typeCharacter) actions.push(`Изменён характер типографической иерархии: ${TYPES[design.typeCharacter].label}`);
  }
  // Баланс по всему реестру, а не только по соседям: если архитектуру уже заняли два и более проекта,
  // а среди уместных для ниши есть менее занятая и почти такая же по оценке, — берём её.
  if (project.architecture.mode !== 'exact' && others.length) {
    const usage = {};
    for (const e of others) usage[e.fingerprint.archetype] = (usage[e.fingerprint.archetype] || 0) + 1;
    const cur = ranked.find(r => r.id === design.primary);
    const used = usage[design.primary] || 0;
    if (cur && used >= 2) {
      const alt = ranked.find(r => r.id !== design.primary && r.score > 0 && r.score >= cur.score - 5
        && (usage[r.id] || 0) < used && !avoid.archetypes.includes(r.id));
      if (alt) {
        const skip = ranked.slice(0, ranked.indexOf(alt)).map(r => r.id);
        const trialAvoid = { ...avoid, archetypes: uniq([...avoid.archetypes, ...skip]) };
        const trial = compose(project, profile, ranked, seed, trialAvoid);
        if (trial.primary === alt.id && !near.some(n => tripleEqual(fingerprintOf(trial), n.fingerprint))) {
          repeated.push(`Архитектура ${ARCHETYPES[design.primary].name} уже используется в ${used} проектах реестра`);
          actions.push(`Для разнообразия реестра выбрана близкая по уместности архитектура ${ARCHETYPES[alt.id].name} вместо ${ARCHETYPES[design.primary].name}`);
          avoid.archetypes = trialAvoid.archetypes;
          design = trial;
        }
      }
    }
    // Тот же первый экран (архитектура + расположение визуала), что у любого более раннего проекта, — меняем расположение.
    const twin = others.find(e => e.fingerprint.archetype === design.primary && e.fingerprint.placement === design.placement);
    if (twin && Object.keys(ARCHETYPES[design.primary].placements).length > 1) {
      const trial = compose(project, profile, ranked, seed, { ...avoid, placements: uniq([...avoid.placements, design.placement]) });
      if (trial.primary === design.primary && trial.placement !== design.placement && !near.some(n => tripleEqual(fingerprintOf(trial), n.fingerprint))) {
        repeated.push(`Первый экран совпадал с проектом «${twin.brand || twin.id}»: та же архитектура и расположение визуала`);
        actions.push(`Изменено расположение основного визуала: «${ARCHETYPES[trial.primary].placements[trial.placement]}»`);
        avoid.placements = uniq([...avoid.placements, design.placement]);
        design = trial;
      }
    }
  }
  // Главный экран (архитектура + расположение визуала) не должен повторять ни один проект реестра.
  // Если свободных расположений у выбранной архитектуры не осталось — берём следующую уместную для ниши
  // архитектуру, у которой свободный первый экран ещё есть.
  if (project.architecture.mode !== 'exact' && others.length) {
    const taken = new Set(others.map(e => `${e.fingerprint.archetype}/${e.fingerprint.placement}`));
    const heroOf = d => `${d.primary}/${d.placement}`;
    if (taken.has(heroOf(design))) {
      const twin = others.find(e => `${e.fingerprint.archetype}/${e.fingerprint.placement}` === heroOf(design));
      const candidates = [ranked.find(r => r.id === design.primary), ...ranked.filter(r => r.id !== design.primary && r.score > 0 && !avoid.archetypes.includes(r.id))].filter(Boolean);
      let fixed = false;
      for (const cand of candidates) {
        const occupied = Object.keys(ARCHETYPES[cand.id].placements).filter(k => taken.has(`${cand.id}/${k}`));
        if (occupied.length === Object.keys(ARCHETYPES[cand.id].placements).length) continue;
        const trialAvoid = { ...avoid, archetypes: uniq([...avoid.archetypes, ...ranked.slice(0, ranked.indexOf(cand)).map(r => r.id)]), placements: occupied };
        const trial = compose(project, profile, ranked, seed, trialAvoid);
        if (trial.primary !== cand.id || taken.has(heroOf(trial)) || near.some(n => tripleEqual(fingerprintOf(trial), n.fingerprint))) continue;
        repeated.push(`Первый экран совпадал с проектом «${twin.brand || twin.id}»: ${ARCHETYPES[design.primary].name}, то же расположение визуала`);
        actions.push(trial.primary === design.primary
          ? `Изменено расположение основного визуала: «${ARCHETYPES[trial.primary].placements[trial.placement]}»`
          : `Свободных композиций у архитектуры ${ARCHETYPES[design.primary].name} не осталось — выбрана ${ARCHETYPES[trial.primary].name} с собственным первым экраном`);
        avoid.archetypes = trialAvoid.archetypes;
        design = trial; fixed = true;
        break;
      }
      if (!fixed) repeated.push(`Первый экран повторяет проект «${twin.brand || twin.id}»: все уместные для ниши композиции уже заняты в реестре`);
    }
  }
  const unresolved = near.some(n => tripleEqual(fingerprintOf(design), n.fingerprint));

  // Мягкие отличия от непосредственно предыдущего проекта: навигация, цвет, форма.
  const prev = near[near.length - 1];
  if (prev) {
    const soft = [
      ['nav', 'navs', 'nav', 'навигационный паттерн', v => NAV_LABELS[v]],
      ['direction', 'directions', 'colorDirection', 'цветовое направление', v => DIRECTIONS[v].label],
      ['shape', 'shapes', 'shape', 'форма элементов', v => SHAPES[v].label],
      ['sectionLayout', 'sectionLayouts', 'sectionLayout', 'композиция секций', v => ({ editorial: 'журнальная сетка', offset: 'смещённая двухколоночная сетка', framed: 'выделенные фоновые секции', quiet: 'минималистичный ритм и разделители' })[v]],
    ];
    for (const [key, avoidKey, fpKey, label, describe] of soft) {
      if (design[key] !== prev.fingerprint[fpKey]) continue;
      if (key === 'direction' && (project.accent || project.brandProfile)) continue;
      avoid[avoidKey].push(design[key]);
      const next = compose(project, profile, ranked, seed, avoid);
      if (next[key] !== design[key]) {
        repeated.push(`С проектом «${prev.brand || prev.id}» совпадает ${label}`);
        actions.push(`Изменено — ${label}: ${describe(next[key])}`);
        design = next;
      }
    }
  }

  const arch = ARCHETYPES[design.primary];
  const type = TYPES[design.typeCharacter];
  const brand = project.brandProfile ? BRANDS[project.brandProfile] : null;
  // В отпечатке у фирменного проекта цвет — это бренд, а не случайное цветовое направление.
  let order = sectionOrder(project, profile, arch, s, design.sectionLayout, seed);
  const libraryUse = refs.length ? applyReferences(refs, design, order, project) : null;
  if (libraryUse) order = libraryUse.order;
  const finalPrint = { ...fingerprintOf(design), sectionOrder: order.join('>'), ...(brand ? { colorDirection: `brand:${project.brandProfile}` } : {}) };
  const palette = brand ? buildBrandPalette(brand, { accent: project.accent }) : buildPalette(design.direction, seed, { accent: project.accent });
  const secondary = design.secondary ? ARCHETYPES[design.secondary] : null;
  const itemsVariant = profile.id === 'cafe' ? 'menu'
    : s.prices || s.itemImages ? 'product'
    : arch.items !== 'product' ? arch.items
    : secondary && secondary.items !== 'product' ? secondary.items : 'cards';

  // ----- Design Brief (§2) -----
  const assumptions = [...project.assumptions];
  const hyp = (label, value) => { assumptions.push(`${label} — гипотеза: ${value}`); return value; };
  const audience = project.targetAudience || hyp('Аудитория', profile.audience);
  const primaryGoal = project.primaryGoal || (project.cta ? `${profile.goal} («${project.cta}»)` : hyp('Целевое действие', profile.goal));
  const brandCharacter = project.brandCharacter || project.visualDirection || hyp('Характер бренда', profile.tone);
  if (profile.id === 'generic') assumptions.push('Ниша не распознана по описанию — использован универсальный сервисный профиль');
  const constraints = [];
  if (!s.prices) constraints.push('Цены не указаны — блоки цен не выводятся и не выдумываются');
  if (!s.contacts) constraints.push('Контакты не указаны — адреса, телефоны и часы работы не выдумываются');
  if (!s.form) constraints.push('Приём заявок не настроен (formAction или e-mail) — форма не выводится');
  if (!s.heroImage && !s.gallery) constraints.push('Изображения не предоставлены — используется абстрактный графический мотив вместо фотографий');
  if (!s.advantages) constraints.push('Доказательства доверия не предоставлены — отзывы, сертификаты и гарантии не выдумываются');
  const cta = project.cta || profile.goal;

  const top = ranked.find(r => r.id === design.primary);
  const rationale = [
    `Ниша определена как «${profile.label}». Основное действие — ${primaryGoal.toLowerCase()}.`,
    project.architecture.mode === 'exact'
      ? `Архитектура ${arch.name} задана в проекте вручную: ${arch.summary}.`
      : `Выбрана архитектура ${arch.name}: ${arch.summary}. ${capitalize(profile.why)}.`,
    project.architecture.mode === 'family' ? `Выбор ограничен семейством «${project.architecture.family}», заданным в редакторе.` : '',
    project.tier === 'luxury' ? 'Класс «люкс»: редакционная подача, контрастная антиква, сдержанная палитра, контурные кнопки и много воздуха.' : '',
    project.tier === 'premium' ? 'Класс «премиум»: авторская типографика и спокойная палитра без перегруза.' : '',
    top && top.reasons.length ? `Сигналы контента: ${top.reasons.join('; ')}.` : '',
    secondary ? `Вспомогательная архитектура — ${secondary.name}: от неё взята подача блоков (${secondary.summary}).` : '',
    actions.length ? 'Композиция скорректирована антишаблонной проверкой — см. uniquenessCheck.' : '',
    libraryUse ? `Учтены профили библиотеки шаблонов (${refs.map(r => `«${r.name}»`).join(', ')}): взяты структурные и UX-решения, а композиция первого экрана, палитра и типографика — собственные.` : '',
  ].filter(Boolean).join(' ');

  const container = { compact: 1280, regular: 1200, airy: 1120 }[arch.rhythm];
  const [h1min, h1max] = arch.h1.map(v => Math.round(v * type.k * 100) / 100);
  // Гарнитуры: у бренда — его собственные, иначе — веб-пара характера типографики (если fonts: "web").
  const web = brand ? [[brand.display, BRAND_FONT_WEIGHTS[brand.display]], [brand.body, BRAND_FONT_WEIGHTS[brand.body]]]
    : project.fonts === 'web' ? WEB_FONTS[design.typeCharacter] : null;
  const webFonts = web && project.fonts === 'web' ? uniq(web.map(([family]) => family)).map(family => ({ family, weights: web.find(w => w[0] === family)[1] })) : [];
  const fontStack = (family, stack) => (family ? `"${family}", ${stack}` : stack);

  const identity = conceptIdentity(design, project);
  // Анимация подбирается под характер бренда, класс, нишу и архитектуру; бюджет механик ограничен интенсивностью.
  const motionPlan = chooseMotion(project, { archetype: design.primary, motion: arch.motion, nicheId: profile.id, seed });
  const signals = uniq(contextSignals(project).map(x => x.why).filter(Boolean));
  return {
    ...(libraryUse ? { libraryUse: { references: refs.map(r => ({ id: r.id, name: r.name, category: r.category, why: r.why })), applied: libraryUse.applied, divergence: libraryUse.divergence, patterns: libraryUse.patterns } } : {}),
    designBrief: {
      businessType: profile.label,
      product: project.mainOffer || project.title || project.niche,
      audience,
      primaryGoal,
      brandCharacter,
      trustProofs: project.advantages.map(a => a.title).filter(Boolean),
      contentPriority: profile.priority,
      constraints,
      assumptions,
      // Что учтено при выборе концепции: ниша, аудитория, класс, характер бренда, задача страницы, конкурентная среда.
      contextFactors: [
        `Ниша: ${profile.label}`,
        `Класс: ${{ standard: 'стандарт', premium: 'премиум', luxury: 'люкс' }[project.tier]}`,
        ...signals.map(capitalize),
        refs.length ? `Конкурентная среда: ${refs.length} ${refs.length === 1 ? 'профиль' : 'профиля'} из библиотеки шаблонов` : 'Конкурентная среда: в библиотеке шаблонов нет подходящих профилей — концепция построена только по нише и контенту',
      ],
    },
    designDNA: {
      conceptName: identity.name,
      conceptFormula: identity.formula,
      primaryArchetype: design.primary,
      secondaryArchetype: design.secondary,
      selectionRationale: rationale,
      colorDirection: brand
        ? `Фирменная палитра «${brand.name}»: ${brand.note}${project.accent ? ` Акцент переопределён в проекте: ${project.accent}.` : ''}`
        : `${capitalize(DIRECTIONS[design.direction].label)}${project.accent ? ` (акцент задан в проекте: ${project.accent})` : ''}`,
      typographyDirection: brand
        ? `Гарнитуры бренда: ${brand.display}${brand.body !== brand.display ? ' и ' + brand.body : ''}; иерархия — ${type.label}`
        : capitalize(type.label) + (web ? `: ${web[0][0]}${web[1][0] !== web[0][0] ? ' и ' + web[1][0] : ''} (Google Fonts)` : ''),
      imageDirection: capitalize(profile.image),
      motionDirection: motionPlan.label,
    },
    homepage: {
      heroComposition: arch.placements[design.placement],
      navigationPattern: NAV_LABELS[design.nav],
      sectionOrder: order,
      sections: [{ id: 'hero', role: ROLES.hero }, ...order.map(id => ({ id, role: ROLES[id] }))],
      primaryCTA: cta,
    },
    uniquenessCheck: {
      templateReuseDetected: unresolved,
      repeatedPatterns: repeated,
      differentiationActions: actions,
      comparedWith: near.map(n => ({ id: n.id, brand: n.brand || n.id, similarity: similarity(finalPrint, n.fingerprint) })),
      fingerprint: finalPrint,
    },
    visualSystem: {
      nicheId: profile.id, itemsLabel: profile.itemsLabel,
      archetype: design.primary, placement: design.placement, nav: design.nav,
      palette, direction: design.direction, sectionLayout: design.sectionLayout,
      typography: { id: design.typeCharacter, display: fontStack(web && web[0][0], type.display), body: fontStack(web && web[1][0], type.body), webFonts, weight: type.weight, tracking: type.tracking, transform: type.transform, h1min, h1max },
      shape: brand ? { id: design.shape, ...SHAPES[design.shape], ...brand.radius, label: `скругления бренда «${brand.name}»` } : { id: design.shape, ...SHAPES[design.shape] },
      brand: brand ? { id: project.brandProfile, name: brand.name, source: brand.source } : null,
      button: { id: design.button, label: BUTTONS[design.button] },
      layout: { container, rhythm: arch.rhythm },
      motion: arch.motion, motionPlan, motif: design.motif,
      commerce: commerceEnabled(project, profile.id),
      forms: chooseForms(project, { shape: design.shape, motif: design.motif, archetype: design.primary }, seed),
      variants: { items: itemsVariant, itemsMechanic: chooseMechanic(project, design.primary, seed, commerceEnabled(project, profile.id)), advantages: arch.advantages, process: arch.process },
      seed,
    },
  };
}

const capitalize = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * Применяет профили библиотеки к уже выбранной концепции: переносит принципы (что работает в изученных сайтах)
 * и следит, чтобы итог не совпал ни с одним источником по композиции.
 */
function applyReferences(refs, design, baseOrder, project) {
  const applied = [], divergence = [];
  let order = [...baseOrder];
  // Принцип: блок, которым изученные сайты открывают страницу, поднимается на шаг выше.
  const votes = {};
  for (const r of refs) { const first = r.traits.sectionOrder.find(id => id !== 'contact'); if (first) votes[first] = (votes[first] || 0) + 1; }
  const fav = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (fav) {
    const i = order.indexOf(fav[0]);
    if (i > 0) { order.splice(i, 1); order.splice(i - 1, 0, fav[0]); applied.push(`Блок «${SECTION_LABELS[fav[0]]}» поднят на шаг выше: в изученных сайтах он идёт сразу после первого экрана`); }
  }
  if (design.secondary && refs.some(r => r.traits.archetypes[0] === design.secondary)) {
    applied.push(`Подача блоков взята от архитектуры ${ARCHETYPES[design.secondary].name}, близкой изученным сайтам, — без переноса их первого экрана`);
  }
  const merged = key => uniq(refs.flatMap(r => r.patterns[key])).slice(0, 6);
  const patterns = { structure: merged('structure'), ux: merged('ux'), content: merged('content'), ideas: merged('ideas'), avoid: merged('avoid') };
  if (patterns.structure.length + patterns.ux.length + patterns.content.length) applied.push('Структурные, UX- и контентные решения источников переданы в ТЗ и промт как принципы для переосмысления');
  // Защита от копирования: порядок секций не должен совпасть с порядком источника.
  for (const r of refs) {
    const same = () => { const theirs = r.traits.sectionOrder.filter(id => order.includes(id)); return theirs.length >= 3 && theirs.join('>') === order.filter(id => theirs.includes(id)).join('>'); };
    if (!same()) continue;
    const movable = r.traits.sectionOrder.filter(id => order.includes(id) && id !== 'contact');
    if (movable.length >= 2) {
      const x = order.indexOf(movable[movable.length - 2]), y = order.indexOf(movable[movable.length - 1]);
      [order[x], order[y]] = [order[y], order[x]];
      divergence.push(`Порядок секций совпадал с источником «${r.name}» — блоки «${SECTION_LABELS[movable[movable.length - 2]]}» и «${SECTION_LABELS[movable[movable.length - 1]]}» переставлены`);
    }
    if (same()) divergence.push(`Порядок секций остался близок к источнику «${r.name}»: в проекте слишком мало блоков, чтобы его изменить`);
  }
  for (const r of refs) {
    const theirs = r.traits.archetypes[0];
    if (!theirs) continue;
    divergence.push(theirs !== design.primary
      ? `Первый экран не повторяет «${r.name}»: у источника он ближе к ${ARCHETYPES[theirs].name}, в проекте — ${ARCHETYPES[design.primary].name}`
      : project.architecture.mode === 'exact'
        ? `Архитектура ${ARCHETYPES[theirs].name} задана вручную и совпадает с источником «${r.name}» — отличаются расположение визуала, порядок секций, палитра и типографика`
        : `Архитектура ${ARCHETYPES[theirs].name} осталась самой уместной для ниши, хотя близка источнику «${r.name}», — отличаются расположение визуала, порядок секций, палитра и типографика`);
  }
  // Исключения источников — пожелание, а не гарантия: если у архитектуры и класса проекта не осталось других
  // вариантов, выбор возвращается к полному списку. Отчёт описывает фактический результат.
  const sameType = refs.filter(r => r.traits.typeCharacter && r.traits.typeCharacter === design.typeCharacter).map(r => `«${r.name}»`);
  const sameShape = refs.filter(r => r.traits.shape && r.traits.shape === design.shape).map(r => `«${r.name}»`);
  if (refs.some(r => r.traits.typeCharacter)) divergence.push(sameType.length
    ? `Характер типографики совпал с источником ${sameType.join(', ')}: для выбранной архитектуры и класса проекта других вариантов не осталось`
    : 'Характер типографики выбран иным, чем у источников');
  if (refs.some(r => r.traits.shape)) divergence.push(sameShape.length
    ? `Форма элементов совпала с источником ${sameShape.join(', ')}: для выбранной архитектуры и класса проекта других вариантов не осталось`
    : 'Форма элементов выбрана иной, чем у источников');
  divergence.push('Палитра строится по нише проекта, а не по источникам');
  return { order, applied, divergence, patterns };
}

/** Запись для реестра проектов: по ней сравниваются следующие генерации. */
export function registryEntry(input, concept) {
  const project = normalizeProject(input);
  return { id: project.id, brand: project.brand || project.niche || project.id, fingerprint: concept.uniquenessCheck.fingerprint };
}

/** Добавляет или заменяет запись проекта в реестре, сохраняя порядок генерации. */
export function upsertRegistry(registry, entry) {
  return [...registry.filter(e => e.id !== entry.id), entry];
}

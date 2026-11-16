import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyzePage, buildProfile } from '../src/engine/site-analysis.js';
import {
  CATEGORIES, PROFILE_FIELDS, duplicateTemplate, exportLibrary, filterLibrary, isProfileEmpty, matchTemplates, mergeLibrary,
  normalizeLibrary, normalizeReferences, normalizeTemplate, parseLibraryImport, parsePalette, referencesFor, toReference,
} from '../src/engine/library.js';
import { root } from './helpers.mjs';

const html = readFileSync(root + 'tests/fixtures/sample-site.html', 'utf8');
const analyzed = () => {
  const { profile, traits, warnings } = buildProfile([analyzePage({ url: 'https://demo-site.ru/', html })]);
  return normalizeTemplate({ id: 'furniture', name: 'Мебельная мастерская', category: 'Услуги и бизнес', business: 'мебель на заказ', url: 'https://demo-site.ru/', profile, traits,
    analysis: { source: 'html', warnings }, provenance: Object.fromEntries(PROFILE_FIELDS.map(f => [f.key, 'auto'])) });
};
const V1 = { id: 'old-1', url: 'https://old.example.org', pages: ['https://old.example.org/a', 'not a url'], name: 'Старый', category: 'Beauty', notes: 'из первой версии', createdAt: '2026-11-16T10:00:00.000Z', status: 'source-saved' };

test('запись формата v1 (PR №36) читается без потерь и не получает выдуманного профиля', () => {
  const t = normalizeTemplate(V1);
  assert.equal(t.id, 'old-1');
  assert.equal(t.name, 'Старый');
  assert.equal(t.category, 'Beauty');
  assert.equal(t.url, 'https://old.example.org/');
  assert.deepEqual(t.pages, ['https://old.example.org/a'], 'некорректные адреса отбрасываются');
  assert.equal(t.createdAt, '2026-11-16T10:00:00.000Z');
  assert.equal(t.status, 'source-saved');
  assert.equal(t.analysis.source, 'none');
  assert.ok(isProfileEmpty(t));
  assert.deepEqual(t.provenance, {});
  for (const c of ['Универсальный', 'Интернет-магазин', 'Услуги и бизнес', 'Каталог', 'Портфолио', 'Beauty', 'Недвижимость', 'Другое']) assert.ok(CATEGORIES.includes(c), c);
});

test('нормализация защищает от мусора и опасных значений', () => {
  const t = normalizeTemplate({ name: '<img src=x onerror=alert(1)>'.repeat(20), url: 'javascript:alert(1)', pages: 'nope', category: 7, profile: { blocks: ['a', '', 3, { x: 1 }], palette: ['#abc — фон', 'мусор', { hex: 'zzz' }, { hex: '#AABBCC', role: 'акцент' }] }, traits: { archetypes: ['catalog', 'нет', 'catalog'], shape: 'треугольник', sectionOrder: ['items', 'hero', 'faq'] } });
  assert.ok(t.name.length <= 120);
  assert.equal(t.url, '');
  assert.deepEqual(t.pages, []);
  assert.deepEqual(t.profile.blocks, ['a', '3']);
  assert.deepEqual(t.profile.palette, [{ hex: '#aabbcc', role: 'фон' }]);
  assert.deepEqual(t.traits.archetypes, ['catalog']);
  assert.equal(t.traits.shape, '');
  assert.deepEqual(t.traits.sectionOrder, ['items', 'faq']);
  assert.equal(t.status, 'manual', 'заполненный вручную профиль не помечается как проанализированный');
  assert.equal(t.provenance.blocks, 'manual');
  assert.deepEqual(normalizeLibrary('строка'), []);
  assert.deepEqual(parsePalette('#fff — фон\n#000000: текст\nбез цвета'), [{ hex: '#ffffff', role: 'фон' }, { hex: '#000000', role: 'текст' }]);
});

test('профиль из анализа сохраняет происхождение полей; ручная запись не выдаётся за анализ', () => {
  const t = analyzed();
  assert.equal(t.status, 'analyzed');
  assert.equal(t.provenance.blocks, 'auto');
  const manual = normalizeTemplate({ ...t, analysis: { source: 'manual' }, provenance: { blocks: 'auto' } });
  assert.equal(manual.provenance.blocks, 'manual');
  assert.equal(manual.status, 'manual');
});

test('дублирование, поиск, фильтр, экспорт и импорт', () => {
  const a = analyzed(), b = normalizeTemplate(V1);
  const copy = duplicateTemplate(a);
  assert.notEqual(copy.id, a.id);
  assert.equal(copy.name, 'Мебельная мастерская (копия)');
  assert.deepEqual(copy.profile, a.profile);
  const lib = [a, b, copy];
  assert.deepEqual(filterLibrary(lib, { query: 'playfair' }).map(t => t.id), [a.id, copy.id], 'поиск идёт и по содержимому профиля');
  assert.deepEqual(filterLibrary(lib, { category: 'Beauty' }).map(t => t.id), ['old-1']);
  assert.equal(filterLibrary(lib, { query: 'копия мебельная' }).length, 1);
  const file = JSON.parse(JSON.stringify(exportLibrary(lib)));
  assert.equal(file.version, 2);
  assert.deepEqual(parseLibraryImport(file).templates, lib, 'экспорт → импорт без изменений');
  assert.equal(parseLibraryImport([V1]).templates[0].id, 'old-1', 'массив v1');
  assert.equal(parseLibraryImport({ version: 1, templates: [V1, null, 'x'] }).rejected, 2);
  assert.throws(() => parseLibraryImport({ foo: 1 }), /нет списка шаблонов/);
  const newer = { ...a, name: 'Обновлён', updatedAt: '2099-01-01T00:00:00.000Z' };
  const merged = mergeLibrary(lib, [newer, b, normalizeTemplate({ id: 'new', name: 'Новый' })]);
  assert.deepEqual([merged.added, merged.updated, merged.skipped], [1, 1, 1]);
  assert.equal(merged.items.find(t => t.id === a.id).name, 'Обновлён');
});

test('подбор профилей под нишу: по сфере, категории и словам; пустые и чужие не подбираются', () => {
  const lib = [analyzed(), normalizeTemplate(V1), normalizeTemplate({ id: 'beauty', name: 'Салон красоты', category: 'Beauty', profile: { blocks: ['1. Первый экран'] } })];
  const furniture = matchTemplates(lib, { niche: 'мебель на заказ' });
  assert.equal(furniture[0].template.id, 'furniture');
  assert.ok(furniture[0].why.length);
  assert.deepEqual(matchTemplates(lib, { niche: 'парикмахерская' }).map(m => m.template.id), ['beauty'], 'пустая запись v1 той же категории не используется');
  assert.deepEqual(matchTemplates(lib, { niche: 'школа сёрфинга' }), []);
  assert.deepEqual(matchTemplates(lib, { niche: '' }), []);
  assert.deepEqual(matchTemplates([], { niche: 'кафе' }), []);
});

test('референс для генератора не содержит палитры, шрифтов, адреса и текстов источника', () => {
  const [ref] = referencesFor([analyzed()], { niche: 'мебель на заказ' });
  const dump = JSON.stringify(ref);
  for (const leak of ['#b4552d', '#f6f1e8', 'Playfair', 'Inter', 'demo-site.ru', 'Обсудить проект', 'обсудить проект', 'Отправить заявку', 'Мебель по вашим размерам']) assert.ok(!dump.includes(leak), `утечка: ${leak}`);
  assert.ok(ref.patterns.structure.length && ref.patterns.ux.length && ref.patterns.content.length && ref.patterns.ideas.length);
  assert.equal(ref.traits.archetypes[0], 'product-first');
  assert.deepEqual(normalizeReferences([ref]), [ref], 'референс стабилен при повторной нормализации');
  assert.deepEqual(normalizeReferences('x'), []);
  assert.equal(normalizeReferences([{ name: 'A', patterns: { structure: ['Кнопка «Купить сейчас» в шапке https://x.ru/a'] } }])[0].patterns.structure[0], 'Кнопка «…» в шапке');
  assert.equal(toReference({ template: analyzed(), why: ['x'] }).why[0], 'x');
});

// ---------- Интеграция с генератором ----------
import { autopilot, buildConcept, buildPrompt, generate, normalizeProject, exportProject } from '../src/engine/index.js';

const refsFor = niche => referencesFor([analyzed()], { niche });

test('без библиотеки генерация не меняется: концепция та же, поля libraryUse нет', () => {
  const plain = autopilot({ niche: 'мебель на заказ', brand: 'Дуб и Ясень' });
  const empty = autopilot({ niche: 'мебель на заказ', brand: 'Дуб и Ясень', designReferences: [] });
  const a = buildConcept(plain.project), b = buildConcept(empty.project);
  assert.equal(a.libraryUse, undefined);
  assert.deepEqual(a.designDNA, b.designDNA);
  assert.deepEqual(a.homepage, b.homepage);
  assert.ok(!plain.prompt.includes('библиотеки шаблонов'));
  assert.ok(!plain.spec.includes('Профили библиотеки'));
  assert.ok(!('designReferences' in plain.project));
});

test('с профилем библиотеки: принципы попадают в концепцию, ТЗ и промт, а композиция источника не повторяется', () => {
  const refs = refsFor('мебель на заказ');
  assert.equal(refs.length, 1);
  const base = autopilot({ niche: 'мебель на заказ', brand: 'Дуб и Ясень' });
  const withLib = autopilot({ niche: 'мебель на заказ', brand: 'Дуб и Ясень', email: 'hello@example.com', designReferences: refs });
  const c = buildConcept(withLib.project);
  const ref = refs[0];
  assert.equal(c.libraryUse.references[0].name, 'Мебельная мастерская');
  assert.ok(c.libraryUse.applied.length && c.libraryUse.divergence.length);
  assert.notEqual(c.designDNA.primaryArchetype, ref.traits.archetypes[0], 'первый экран не повторяет архитектуру источника');
  assert.notEqual(c.visualSystem.typography.id, ref.traits.typeCharacter, 'типографика отличается от источника');
  assert.notEqual(c.visualSystem.shape.id, ref.traits.shape, 'форма элементов отличается от источника');
  const theirs = ref.traits.sectionOrder.filter(id => c.homepage.sectionOrder.includes(id));
  assert.notEqual(c.homepage.sectionOrder.filter(id => theirs.includes(id)).join('>'), theirs.join('>'), 'порядок секций не совпадает с источником');
  assert.equal(c.homepage.sectionOrder.at(-1), 'contact', 'контакты остаются последними');
  assert.match(c.designDNA.selectionRationale, /Учтены профили библиотеки/);
  assert.match(withLib.spec, /### Профили библиотеки шаблонов/);
  assert.match(withLib.prompt, /Решения из библиотеки шаблонов/);
  assert.match(withLib.prompt, /Запрещено: копировать тексты/);
  for (const leak of ['#b4552d', 'Playfair', 'demo-site.ru', 'Обсудить проект']) assert.ok(!withLib.prompt.includes(leak) && !withLib.spec.includes(leak), `утечка в промт или ТЗ: ${leak}`);
  const r = generate(withLib.project);
  assert.deepEqual(r.audit.errors, [], 'сайт с профилем библиотеки проходит аудит');
  assert.ok(!r.html.includes('#b4552d') && !r.html.includes('Playfair'), 'палитра и шрифт источника не попадают в страницу');
  assert.ok(base.project.id && !buildConcept(base.project).libraryUse);
});

test('референсы сохраняются в проекте: экспорт → импорт даёт ту же концепцию; их можно убрать', () => {
  const withLib = autopilot({ niche: 'мебель на заказ', brand: 'Дуб и Ясень', designReferences: refsFor('мебель на заказ') });
  const first = generate(withLib.project);
  const again = generate(JSON.parse(JSON.stringify(first.exported)));
  assert.deepEqual(again.concept.libraryUse, first.concept.libraryUse);
  assert.deepEqual(again.concept.homepage, first.concept.homepage);
  const { designReferences, ...without } = first.exported;
  assert.equal(generate(without).concept.libraryUse, undefined);
  assert.equal(exportProject(normalizeProject(without)).designReferences, undefined);
});

test('один профиль не превращает разные ниши в один шаблон', () => {
  const universal = normalizeTemplate({ ...analyzed(), id: 'uni', category: 'Универсальный', business: '', name: 'Универсальный референс' });
  const seen = new Set(), heroes = new Set();
  let registry = [];
  for (const niche of ['салон красоты', 'ювелирная мастерская', 'доставка еды', 'стоматология', 'школа программирования', 'фотограф', 'ремонт квартир', 'фитнес-клуб']) {
    const refs = referencesFor([universal], { niche });
    assert.equal(refs.length, 1, niche);
    const { project } = autopilot({ niche, email: 'hello@example.com', designReferences: refs }, { registry });
    const r = generate(project, { registry });
    registry = r.registry;
    assert.deepEqual(r.audit.errors, [], niche);
    assert.equal(r.concept.uniquenessCheck.templateReuseDetected, false, niche);
    seen.add(r.concept.designDNA.primaryArchetype);
    const hero = `${r.concept.visualSystem.archetype}/${r.concept.visualSystem.placement}`;
    assert.ok(!heroes.has(hero), `повтор первого экрана: ${hero} (${niche})`);
    heroes.add(hero);
  }
  assert.ok(seen.size >= 4, `архитектур: ${seen.size}`);
});

test('архитектура, заданная вручную, уважается даже при совпадении с источником — и это честно отмечено', () => {
  const refs = refsFor('мебель на заказ');
  const { project } = autopilot({ niche: 'мебель на заказ', designReferences: refs });
  const c = buildConcept({ ...project, architecture: refs[0].traits.archetypes[0] });
  assert.equal(c.designDNA.primaryArchetype, refs[0].traits.archetypes[0]);
  assert.ok(c.libraryUse.divergence.some(d => /задана вручную и совпадает с источником/.test(d)));
});

test('концепция получает имя и формулу, а бриф — перечень учтённых факторов', () => {
  const names = new Set();
  for (const [niche, tier] of [['стоматология', 'standard'], ['стоматология', 'luxury'], ['тату-студия', 'standard'], ['свадебный фотограф', 'luxury'], ['интернет-магазин электроники', 'standard'], ['юридическая фирма', 'premium']]) {
    const c = buildConcept(autopilot({ niche, tier }).project);
    assert.ok(c.designDNA.conceptName && c.designDNA.conceptFormula.includes('архитектура'), niche);
    assert.ok(c.designBrief.contextFactors.some(f => f.startsWith('Ниша:')) && c.designBrief.contextFactors.some(f => f.startsWith('Конкурентная среда:')));
    names.add(c.designDNA.conceptName);
  }
  assert.ok(names.size >= 5, [...names].join(', '));
  assert.ok(names.has('Minimal Luxury') && names.has('Brutalist'));
  const prompt = buildPrompt(autopilot({ niche: 'тату-студия' }).project, buildConcept(autopilot({ niche: 'тату-студия' }).project));
  assert.match(prompt, /Концепция: Brutalist/);
});

test('если варианты типографики и формы исчерпаны, отчёт не утверждает, что они отличаются', () => {
  const { project } = autopilot({ niche: 'ювелирная мастерская', tier: 'luxury', email: 'hello@example.com' });
  const ref = (typeCharacter, shape, name) => ({ name, traits: { typeCharacter, shape }, patterns: {} });
  const c = buildConcept({ ...project, architecture: 'editorial', designReferences: [ref('didone-contrast', 'sharp', 'А'), ref('serif-editorial', 'soft', 'Б')] });
  const refTypes = ['didone-contrast', 'serif-editorial'], refShapes = ['sharp', 'soft'];
  const text = c.libraryUse.divergence.join(' | ');
  assert.equal(refTypes.includes(c.visualSystem.typography.id), /Характер типографики совпал/.test(text));
  assert.equal(refShapes.includes(c.visualSystem.shape.id), /Форма элементов совпала/.test(text));
  assert.ok(refTypes.includes(c.visualSystem.typography.id), 'сценарий действительно исчерпывает варианты типографики');
});

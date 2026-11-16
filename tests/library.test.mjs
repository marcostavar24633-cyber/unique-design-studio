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

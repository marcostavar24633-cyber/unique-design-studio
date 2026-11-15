// Фирменные профили живых проектов (src/engine/brands.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANDS, buildConcept, contrast, exportProject, generate, normalizeProject } from '../src/engine/index.js';

const base = id => ({ id, brandProfile: id, brand: BRANDS[id].name, niche: 'услуги', title: 'Заголовок', cta: 'Связаться', contacts: { email: 'a@example.com' }, services: [['Позиция', 'Описание']] });

test('профили описаны полностью и со ссылкой на источник', () => {
  assert.ok(Object.keys(BRANDS).length >= 8);
  for (const [id, b] of Object.entries(BRANDS)) {
    for (const f of ['name', 'source', 'mode', 'bg', 'surface', 'text', 'muted', 'accent', 'display', 'body', 'note']) assert.ok(b[f], `${id}.${f}`);
    for (const f of ['bg', 'surface', 'text', 'muted', 'accent']) assert.match(b[f], /^#[0-9a-f]{6}$/, `${id}.${f}`);
    assert.match(b.source, /@[0-9a-f]{7}/, `${id}: источник с коммитом`);
    for (const f of ['sm', 'md', 'lg', 'button']) assert.ok(b.radius[f], `${id}.radius.${f}`);
  }
});

test('цвета бренда попадают на страницу, контраст остаётся в норме', () => {
  for (const id of Object.keys(BRANDS)) {
    const b = BRANDS[id];
    const r = generate(base(id));
    const p = r.concept.visualSystem.palette;
    assert.equal(p.bg, b.bg, id);
    assert.equal(p.accent, b.accent, id);
    assert.equal(p.mode, b.mode, id);
    assert.ok(contrast(p.text, p.bg) >= 7, `${id}: текст`);
    assert.ok(contrast(p.muted, p.bg) >= 4.5, `${id}: вторичный текст`);
    assert.ok(contrast(p.accentText, p.accent) >= 4.5, `${id}: кнопка`);
    assert.ok(r.html.includes(`--ds-bg:${b.bg}`), id);
    assert.deepEqual(r.audit.errors, [], id);
  }
});

test('гарнитуры бренда подключаются из Google Fonts и стоят первыми в стеке', () => {
  for (const id of Object.keys(BRANDS)) {
    const b = BRANDS[id];
    const r = generate(base(id));
    const t = r.concept.visualSystem.typography;
    assert.ok(t.display.startsWith(`"${b.display}"`), id);
    assert.ok(t.body.startsWith(`"${b.body}"`), id);
    assert.ok(r.html.includes(`family=${b.display.replace(/ /g, '+')}:wght@`), `${id}: ${b.display}`);
    assert.match(r.concept.designDNA.typographyDirection, new RegExp(b.display));
  }
  // Явный выбор системных шрифтов отключает загрузку, но имена бренда остаются в стеке.
  const sys = generate({ ...base('hair'), fonts: 'system' });
  assert.doesNotMatch(sys.html, /fonts\.googleapis/);
  assert.ok(sys.concept.visualSystem.typography.display.startsWith('"Cormorant Garamond"'));
});

test('бренд задаёт вид, а композицию по-прежнему выбирает движок с проверкой соседей', () => {
  let registry = [];
  const prints = [];
  for (let i = 0; i < 4; i++) {
    const r = generate({ ...base('slopay-buket'), id: `slopay-${i}`, niche: 'съедобные букеты' }, { registry });
    registry = r.registry;
    prints.push(r.entry.fingerprint);
    assert.equal(r.concept.visualSystem.palette.bg, BRANDS['slopay-buket'].bg);
    assert.equal(r.entry.fingerprint.colorDirection, 'brand:slopay-buket');
    assert.equal(r.concept.uniquenessCheck.differentiationActions.some(a => /цветовое направление/.test(a)), false, 'цвет бренда не «меняется» проверкой');
  }
  for (let i = 1; i < prints.length; i++) {
    const [a, b] = [prints[i - 1], prints[i]];
    assert.ok(!(a.archetype === b.archetype && a.placement === b.placement && a.typeCharacter === b.typeCharacter), `проект ${i}`);
  }
});

test('скругления бренда переопределяют форму архитектуры', () => {
  const r = generate(base('photograf'));
  assert.equal(r.concept.visualSystem.shape.md, BRANDS.photograf.radius.md);
  assert.ok(r.html.includes(`--ds-radius-md:${BRANDS.photograf.radius.md}`));
});

test('профиль сохраняется при экспорте и импорте; неизвестный профиль игнорируется', () => {
  const raw = base('raki');
  const out = exportProject(raw, buildConcept(raw));
  assert.equal(out.brandProfile, 'raki');
  assert.equal(normalizeProject(out).brandProfile, 'raki');
  assert.equal(normalizeProject({ ...raw, brandProfile: 'нет-такого' }).brandProfile, '');
  assert.equal(normalizeProject({ brand: 'x', niche: 'кофейня' }).fonts, 'system', 'без бренда шрифты по умолчанию системные');
  assert.equal(normalizeProject({ brand: 'x', niche: 'кофейня', brandProfile: 'penka' }).fonts, 'web', 'с брендом — веб');
  // Экспорт без бренда не превращает умолчание «system» в явный выбор: после импорта и выбора бренда шрифты веб.
  const plain = exportProject({ brand: 'x', niche: 'кофейня' });
  assert.equal(plain.fonts, undefined);
  assert.equal(normalizeProject({ ...plain, brandProfile: 'penka' }).fonts, 'web');
  // Явный выбор, отличный от умолчания, сохраняется.
  assert.equal(exportProject({ ...raw, fonts: 'system' }).fonts, 'system');
});

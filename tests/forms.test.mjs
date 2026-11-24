// Формы страницы: маски фотографий, без декоративных разделителей секций.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalizeProject, exportProject } from '../src/engine/index.js';
import { chooseForms, dividerHtml, formsCss, MASKS } from '../src/engine/forms.js';

const svc = [['Фо Бо', 'Бульон', '450 ₽', 'https://example.com/1.jpg'], ['Нем', 'Роллы', '320 ₽', 'https://example.com/2.jpg'], ['Бун Ча', 'Свинина', '490 ₽', 'https://example.com/3.jpg']];
const site = extra => generate({ niche: 'кафе вьетнамская кухня', brand: 'Ханой', contacts: { email: 'a@b.ru' }, services: svc, ...extra });

test('все маски фото рендерятся; старые настройки разделителей больше не создают линий', () => {
  for (const mask of Object.keys(MASKS)) {
    const g = site({ imageMask: mask, sectionDivider: 'wave' });
    assert.deepEqual(g.concept.visualSystem.forms, { mask, divider: 'none' });
    assert.ok(g.audit.ok, `${mask}: ${g.audit.errors.map(e => e.message).join('; ')}`);
    assert.doesNotMatch(g.html, /ds-divider--|uds-divider/);
  }
});

test('маска только у фото: не у карточек, кнопок и не у фона первого экрана', () => {
  for (const mask of ['arch', 'notch', 'slant', 'blob', 'pill']) {
    const css = formsCss({ mask, divider: 'none' });
    const selectors = css.slice(0, css.indexOf('{')).split(',');
    for (const s of selectors) assert.match(s, / img$/, `${mask}: ${s}`);
    assert.doesNotMatch(css, /hero__photo-bg|\.item\{|ds-button|\.item,/);
    assert.match(css, /border-radius:var\(--ds-radius-md,18px\)/, `${mask}: все фото остаются прямоугольными со скруглением`);
  }
});

test('разделители секций полностью отсутствуют из HTML и CSS', () => {
  const g = site({ sectionDivider: 'double-wave' });
  assert.equal(dividerHtml('wave'), '');
  assert.match(formsCss({ mask: 'none', divider: 'wave' }), /border-radius:var\(--ds-radius-md,18px\)/);
  assert.doesNotMatch(g.html, /ds-divider|uds-divider/);
  assert.equal(g.concept.visualSystem.forms.divider, 'none');
});

test('форма фото во всех стилях остаётся прямоугольной со скруглением; разделители отключены', () => {
  for (let seed = 0; seed < 30; seed++) {
    const p = normalizeProject({ niche: 'кафе' });
    const sharpMask = chooseForms(p, { shape: 'sharp', motif: 'waves', archetype: 'editorial' }, seed).mask;
    assert.equal(sharpMask, 'rounded-rect');
    assert.equal(chooseForms(p, { shape: 'round', motif: 'blobs', archetype: 'brutalist' }, seed).mask, 'rounded-rect');
    assert.equal(chooseForms(p, { shape: 'soft', motif: 'waves', archetype: 'minimal' }, seed).divider, 'none');
    const lux = normalizeProject({ niche: 'ювелир', tier: 'luxury' });
    assert.equal(chooseForms(lux, { shape: 'round', motif: 'arcs', archetype: 'editorial' }, seed).mask, 'rounded-rect');
  }
});

test('форма фотографии сохраняется в экспорте, устаревший разделитель удаляется', () => {
  const e = exportProject(normalizeProject({ niche: 'кафе', imageMask: 'arch', sectionDivider: 'steps' }));
  assert.equal(e.imageMask, 'arch');
  assert.equal('sectionDivider' in e, false);
});

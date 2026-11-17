// Формы страницы: маски фото и разделители секций — от характера бренда, без вреда доступности.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, normalizeProject, exportProject } from '../src/engine/index.js';
import { chooseForms, dividerHtml, formsCss, DIVIDERS, MASKS } from '../src/engine/forms.js';

const svc = [['Фо Бо', 'Бульон', '450 ₽', 'https://example.com/1.jpg'], ['Нем', 'Роллы', '320 ₽', 'https://example.com/2.jpg'], ['Бун Ча', 'Свинина', '490 ₽', 'https://example.com/3.jpg']];
const site = extra => generate({ niche: 'кафе вьетнамская кухня', brand: 'Ханой', contacts: { email: 'a@b.ru' }, services: svc, ...extra });

test('каждая маска и разделитель рендерятся и проходят аудит', () => {
  for (const mask of Object.keys(MASKS)) for (const divider of Object.keys(DIVIDERS)) {
    const g = site({ imageMask: mask, sectionDivider: divider });
    assert.deepEqual(g.concept.visualSystem.forms, { mask, divider });
    assert.ok(g.audit.ok, `${mask}/${divider}: ${g.audit.errors.map(e => e.message).join('; ')}`);
    if (divider !== 'none') assert.match(g.html, new RegExp(`<div class="ds-container ds-divider ds-divider--${divider}" aria-hidden="true">`));
    else assert.doesNotMatch(g.html, /ds-divider--/);
  }
});

test('маска только у фото: не у карточек, кнопок и не у фона первого экрана', () => {
  for (const mask of ['arch', 'notch', 'slant', 'blob', 'pill']) {
    const css = formsCss({ mask, divider: 'none' });
    const selectors = css.slice(0, css.indexOf('{')).split(',');
    for (const s of selectors) assert.match(s, / img$/, `${mask}: ${s}`);
    assert.doesNotMatch(css, /hero__photo-bg|\.item\{|ds-button|\.item,/);
  }
});

test('разделитель — только между секциями, декоративный и не перехватывает клики', () => {
  const g = site({ sectionDivider: 'wave' });
  const count = (g.html.match(/ds-divider--wave/g) || []).length;
  assert.equal(count, g.concept.homepage.sectionOrder.length - 1);
  assert.match(formsCss({ mask: 'none', divider: 'wave' }), /pointer-events:none/);
  assert.match(dividerHtml('zigzag'), /vector-effect="non-scaling-stroke"/);
  assert.equal(dividerHtml('none'), '');
});

test('выбор следует характеру: острые углы — срезы, брутализм — без мягких форм, минимализм — тихие разделители', () => {
  for (let seed = 0; seed < 30; seed++) {
    const p = normalizeProject({ niche: 'кафе' });
    assert.ok(['notch', 'slant', 'none'].includes(chooseForms(p, { shape: 'sharp', motif: 'waves', archetype: 'editorial' }, seed).mask));
    assert.ok(['none', 'notch'].includes(chooseForms(p, { shape: 'round', motif: 'blobs', archetype: 'brutalist' }, seed).mask));
    assert.ok(['line', 'none'].includes(chooseForms(p, { shape: 'soft', motif: 'waves', archetype: 'minimal' }, seed).divider));
    const lux = normalizeProject({ niche: 'ювелир', tier: 'luxury' });
    assert.ok(!['blob', 'pill'].includes(chooseForms(lux, { shape: 'round', motif: 'arcs', archetype: 'editorial' }, seed).mask), 'люкс без «капель»');
  }
});

test('ручной выбор формы сохраняется в экспорте', () => {
  const e = exportProject(normalizeProject({ niche: 'кафе', imageMask: 'arch', sectionDivider: 'steps' }));
  assert.equal(e.imageMask, 'arch');
  assert.equal(e.sectionDivider, 'steps');
});

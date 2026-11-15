import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARCHETYPE_IDS, auditSite, generate } from '../src/engine/index.js';
import { CORE_CSS } from '../src/engine/core-css.js';
import { buildCoreModule } from '../scripts/sync-core.mjs';
import { examples, full, root } from './helpers.mjs';

test('примеры проходят проверку перед выдачей без ошибок (§9)', () => {
  for (const ex of examples) {
    const r = generate(ex);
    assert.deepEqual(r.audit.errors, [], ex.id);
    assert.ok(r.html.length < 60_000, `${ex.id}: страница должна оставаться лёгкой`);
  }
});

test('ничего не выдумывается: без данных нет цен, контактов, отзывов и лишних секций', () => {
  const r = generate({ brand: 'Тест', niche: 'кофейня' });
  assert.ok(!r.html.includes('class="price"'));
  assert.ok(!/₽|\+7|отзыв|гаранти|сертификат/i.test(r.html.replace(/<style>[\s\S]*?<\/style>/, '')));
  assert.deepEqual(r.concept.homepage.sectionOrder, ['contact']);
  assert.ok(!r.html.includes('<form'));
  assert.ok(r.audit.errors.some(e => e.id === 'cta-path'), 'отсутствие способа связи — ошибка, а не выдуманный телефон');
  assert.ok(r.concept.designBrief.constraints.some(c => c.includes('Цены не указаны')));
});

test('цены выводятся только из данных проекта', () => {
  const r = generate({ ...full, architecture: 'product-first' });
  const shown = [...r.html.matchAll(/<p class="price">([^<]*)<\/p>/g)].map(m => m[1]);
  assert.ok(shown.length >= 2);
  for (const v of shown) assert.ok(['1 500 ₽', 'от 4 000 ₽'].includes(v), v);
});

test('пользовательский текст экранируется, опасные ссылки отбрасываются', () => {
  const r = generate({
    ...full, brand: '<script>alert(1)</script>', title: '"><img src=x onerror=alert(1)>', ctaUrl: 'javascript:alert(1)',
    images: { hero: 'javascript:alert(1)' }, formAction: 'javascript:alert(1)', services: [['<b>x</b>', '</style><script>1</script>']],
  });
  const body = r.html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
  assert.ok(!body.includes('<script>alert'));
  assert.ok(!body.includes('<img src=x'));
  assert.ok(!/javascript:/i.test(r.html));
  assert.ok(!r.html.includes('</style><script>1'));
  assert.ok(!/<script type="application\/ld\+json">[^<]*<\/?script>alert/.test(r.html));
});

test('доступность разметки для всех архитектур', () => {
  for (const id of ARCHETYPE_IDS) {
    const { html } = generate({ ...full, architecture: id });
    assert.equal((html.match(/<h1\b/g) || []).length, 1, id);
    assert.match(html, /<html lang="ru">/);
    assert.match(html, /class="skip" href="#main"/);
    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /:focus-visible/);
    assert.ok(!/<img(?![^>]*\balt=)/.test(html), `${id}: img без alt`);
    for (const m of html.matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"/g)) assert.ok(html.includes(`<label for="${m[1]}"`) || html.includes(`for="${m[1]}"`), `${id}: поле ${m[1]} без label`);
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const m of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(m[1]), `${id}: якорь #${m[1]}`);
  }
});

test('движение: контент не прячется без JS, скрипт уважает reduced motion', () => {
  const { html } = generate({ ...full, architecture: 'immersive' });
  assert.ok(html.includes("classList.add('js-reveal')"));
  assert.ok(html.includes('prefers-reduced-motion: reduce'));
  assert.ok(!/\[data-reveal\]\{opacity:0/.test(html.replace(/html\.js-reveal \[data-reveal\]/g, '')), 'скрытие только при наличии JS');
  assert.ok(!generate({ ...full, architecture: 'minimal' }).html.includes('<script>('), 'статичная архитектура не несёт скрипт анимации');
});

test('аудит ловит дефекты', () => {
  const r = generate(full);
  const broken = r.html.replace('<h1 id="hero-h">', '<h1>x</h1><h1 id="hero-h">').replace('href="#main"', 'href="#nowhere"').replace(/ alt="[^"]*"/, '');
  const ids = auditSite(broken, r.concept, full).errors.map(e => e.id);
  for (const id of ['h1', 'links', 'img-alt']) assert.ok(ids.includes(id), id);
  const reuse = { ...r.concept, uniquenessCheck: { ...r.concept.uniquenessCheck, templateReuseDetected: true } };
  assert.ok(auditSite(r.html, reuse, full).errors.some(e => e.id === 'uniqueness'));
});

test('ядро дизайн-системы подключено и синхронизировано с design-system/*.css', () => {
  // Переводы строк нормализуются: на Windows git может отдать файл с CRLF.
  const lf = s => s.replace(/\r\n/g, '\n');
  assert.equal(lf(readFileSync(root + 'src/engine/core-css.js', 'utf8')), lf(buildCoreModule()), 'запустите npm run sync-core');
  const { html } = generate(full);
  assert.ok(html.includes(CORE_CSS));
  const tokens = readFileSync(root + 'design-system/tokens.css', 'utf8');
  for (const name of ['--ds-bg', '--ds-surface', '--ds-text', '--ds-accent', '--ds-accent-contrast', '--ds-font-body', '--ds-font-display']) {
    assert.ok(tokens.includes(name) && html.split(CORE_CSS)[1].includes(`${name}:`), `профиль проекта переопределяет ${name}`);
  }
});

test('загруженные фотографии сохраняются в проекте и встраиваются в автономный HTML', () => {
  const photo = 'data:image/png;base64,iVBORw0KGgo=';
  const project = {
    ...full,
    images: { hero: photo, heroAlt: 'Главное фото проекта' },
    gallery: [{ src: photo, alt: 'Фото в галерее', caption: 'Работа 1' }],
    services: [['Позиция с фото', 'Описание', '1 500 ₽', photo]],
  };
  const { html, exported } = generate(project);
  assert.ok(html.includes('alt="Главное фото проекта"'));
  assert.ok(html.includes('alt="Фото в галерее"'));
  assert.ok(html.includes('alt="Позиция с фото"'));
  assert.ok((html.match(/src="data:image\/png;base64,iVBORw0KGgo="/g) || []).length >= 3);
  assert.equal(exported.images.hero, photo);
  assert.equal(exported.gallery[0].src, photo);
  assert.equal(exported.services[0][3], photo);
});

test('отдельные focal points для hero, галереи и карточек применяются на разных ширинах', () => {
  const r = generate({ ...full, services: [['Товар', 'Описание', '1 000 ₽', 'data:image/webp;base64,AA==']], images: { hero: 'data:image/webp;base64,AA==', heroAlt: 'Фото' }, imageArtDirection: { hero: { desktop: { x: 24, y: 36 }, tablet: { x: 50, y: 42 }, mobile: { x: 72, y: 60 } }, services: { 0: { desktop: { x: 35, y: 45 }, mobile: { x: 75, y: 85 } } } } });
  assert.match(r.html, /--ds-crop-desktop:24% 36%/);
  assert.match(r.html, /--ds-crop-tablet:50% 42%/);
  assert.match(r.html, /--ds-crop-mobile:72% 60%/);
  assert.ok(r.html.includes('object-position:var(--ds-crop-mobile'));
  assert.match(r.html, /--ds-crop-desktop:35% 45%/);
});

 
test('ALT-описания карточек товаров сохраняются при импорте и выводятся в HTML', () => {
  const photo = 'data:image/webp;base64,AA==';
  const { html, exported } = generate({ ...full, services: [['Телескоп', 'Оптическая труба', '9 900 ₽', photo, 'Телескоп-рефрактор на штативе']] });
  assert.ok(html.includes('alt="Телескоп-рефрактор на штативе"'));
  assert.equal(exported.services[0][4], 'Телескоп-рефрактор на штативе');
});
 
test('SEO-аудит предупреждает о повторных и слабых ALT и длине метаданных', () => {
  const project = { ...full, title: 'Коротко', description: 'Описание', images: { hero: 'data:image/webp;base64,AA==', heroAlt: 'photo.jpg' }, gallery: [{ src: 'data:image/webp;base64,AA==', alt: 'photo.jpg' }] };
  const r = generate(project);
  const ids = r.audit.warnings.map(w => w.id);
  assert.ok(ids.includes('img-alt-duplicates'));
  assert.ok(ids.includes('img-alt-quality'));
  assert.ok(ids.includes('seo-title-length'));
  assert.ok(ids.includes('seo-description-length'));
});

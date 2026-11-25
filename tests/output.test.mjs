import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARCHETYPE_IDS, auditSite, generate } from '../src/engine/index.js';
import { CORE_CSS } from '../src/engine/core-css.js';
import { buildCoreModule } from '../scripts/sync-core.mjs';
import { examples, full, root } from './helpers.mjs';

test('immersive hero adds a stronger, readable mobile text zone', () => {
  const css = readFileSync(new URL('../src/engine/css.js', import.meta.url), 'utf8');
  const mobile = css.slice(css.indexOf('@media(max-width:600px)', css.indexOf('hero__scrim')));
  assert.ok(mobile.includes('.hero__scrim{background:linear-gradient(to top,rgba(0,0,0,.9)'));
  assert.ok(mobile.includes('.hero--immersive h1{max-width:14ch'));
  assert.ok(mobile.includes('text-wrap:balance'));
  assert.ok(mobile.includes('.hero--immersive .actions .ds-button{min-height:48px'));
});

test('примеры проходят проверку перед выдачей без ошибок (§9)', () => {
  for (const ex of examples) {
    const r = generate(ex);
    assert.deepEqual(r.audit.errors, [], ex.id);
    assert.ok(r.html.length < 60_000, `${ex.id}: страница должна оставаться лёгкой`);
  }
});

test('короткие заголовки и подписи получают однострочную автоподгонку', () => {
  const { html } = generate({ ...full, title: 'Индивидуальные программы тренировок для любого уровня подготовки' });
  assert.match(html, /\.uds-fit-text\{[^}]*white-space:nowrap!important/);
  assert.match(html, /selector='h1,h2,h3,\.kicker,\.nav__cta,\.ds-button,\.item__title,\.price/);
  assert.match(html, /\.nav__links a\{display:inline-flex;flex:0 0 auto/);
  assert.match(html, /addEventListener\('resize',schedule/);
  assert.match(html, /selectNodeContents\(el\)/);
  assert.match(html, /var style=getComputedStyle\(el\)/);
  assert.match(html, /new ResizeObserver/);
  assert.match(html, /resizeObserver\.observe\(parent\)/);
  assert.match(html, /\.uds-fit-text--wrap\{[^}]*overflow-wrap:anywhere/);
  assert.match(html, /if\(available<24\)/);
  assert.match(html, /textWidth\(el\)<=width-6/);
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

test('скрытые секции услуг не оставляют битых ссылок ни в одной архитектуре', () => {
  for (const architecture of ARCHETYPE_IDS) {
    const { html, audit } = generate({ ...full, architecture, fieldStates: { cta: 'hidden', ctaUrl: 'hidden', 'sections.items': 'hidden' } });
    assert.ok(!audit.errors.some(error => error.id === 'links'), architecture);
    assert.ok(audit.errors.some(error => error.id === 'cta'), `${architecture}: скрытый CTA остаётся в отчёте`);
    if (architecture === 'modular-grid') assert.doesNotMatch(html, /class="bento__cell bento__cta"/);
  }
});

test('горизонтальная фотолента доступна с клавиатуры и имеет видимый фокус', () => {
  const gallery = Array.from({ length: 4 }, (_, i) => ({ src: `data:image/webp;base64,AA${i}`, alt: `Кадр ${i + 1}` }));
  const { html } = generate({ ...full, gallery, photoComposition: 'filmstrip' });
  assert.match(html, /class="gallery gallery--filmstrip" role="list" tabindex="0" aria-label="Галерея фотографий\. Прокручивайте по горизонтали/);
  assert.match(html, /\.gallery--filmstrip:focus-visible\{outline:3px solid var\(--ds-accent\);outline-offset:4px\}/);
});

test('неизвестная внутренняя цель CTA заменяется рабочим адресом и указывается в отчёте', () => {
  const { html, audit } = generate({ ...full, ctaUrl: '#missing-section' });
  assert.ok(!html.includes('href="#missing-section"'));
  assert.match(html, /data-cta="primary" href="#contact"/);
  assert.ok(audit.errors.some(error => error.id === 'cta-target-invalid' && error.message.includes('#missing-section')));
});

test('служебные подписи, действия и ALT работают на английской версии страницы', () => {
  const contacts = { phone: '+1 555 0100', email: 'hello@example.com', address: '10 Main Street', hours: 'Mon–Fri' };
  const local = generate({ ...full, lang: 'en', architecture: 'local-presence', contacts });
  assert.match(local.html, /<span>Address<\/span>/);
  assert.match(local.html, /<span>Hours<\/span>/);
  const hub = generate({ ...full, lang: 'en', architecture: 'contact-hub', contacts });
  assert.match(hub.html, /<span>Phone<\/span>/);
  assert.match(hub.html, /<span>Email<\/span>/);
  const product = generate({ ...full, lang: 'en', architecture: 'product-first' });
  assert.ok(product.html.includes('More details'));
  const portfolio = generate({ ...full, lang: 'en', architecture: 'portfolio-feature', gallery: [{ src: 'data:image/webp;base64,AA==', alt: '' }] });
  assert.ok(portfolio.html.includes('alt="Featured work"'));
  const translatedSections = generate({ ...full, contactTitle: '', lang: 'en', architecture: 'immersive', itemsMechanic: 'expand', faqs: [['Question?', 'Answer.']] });
  for (const label of ['About', 'Benefits', 'How it works', 'Questions', 'Contact', 'Services', 'More details']) {
    assert.ok(translatedSections.html.includes(label), `missing English system label: ${label}`);
  }
  assert.ok(!/О нас|Преимущества|Как это работает|Частые вопросы|Подробнее/.test(translatedSections.html));
  const rail = generate({ ...full, lang: 'en', itemsMechanic: 'rail' });
  assert.match(rail.html, /aria-label="Services: Scroll horizontally →"/);
  assert.match(rail.html, /class="rail__hint" aria-hidden="true">Scroll horizontally →/);
  const flip = generate({ ...full, lang: 'en', itemsMechanic: 'flip', services: full.services.map((item, index) => [item[0], item[1], item[2], `data:image/webp;base64,${index}`]) });
  assert.match(flip.html, /Hover or focus the card to learn more/);
  const story = generate({ ...full, lang: 'en', architecture: 'storytelling' });
  assert.match(story.html, /<nav aria-label="Page chapters">/);
  const brutalist = generate({ ...full, lang: 'en', architecture: 'brutalist' });
  assert.match(brutalist.html, /<nav aria-label="Page sections">/);
});

test('английская подпись раздела услуг сохраняет смысл выбранной ниши', () => {
  const cases = [
    ['Кофейня / кафе / ресторан', 'Menu'], ['Интернет-магазин техники', 'Catalog'],
    ['магазин морепродуктов', 'Products'], ['Обучение и курсы', 'Program'],
    ['Цифровой продукт / IT-сервис', 'Features'], ['События и праздники', 'Packages'],
    ['Бутик / ювелирные изделия и аксессуары', 'Collections'],
    ['автосервис', 'What we repair'], ['фитнес-клуб', 'Services'],
  ];
  for (const [niche, label] of cases) {
    const { html } = generate({ brand: 'Studio', niche, title: 'Example', lang: 'en', services: [['One', 'Description'], ['Two', 'Description'], ['Three', 'Description']] });
    assert.ok(html.includes(`>${label}</h2>`), `${niche} should use “${label}”`);
  }
});

test('движение: контент не прячется без JS, скрипт уважает reduced motion', () => {
  const { html } = generate({ ...full, architecture: 'immersive' });
  assert.ok(html.includes("classList.add('js-reveal')"));
  assert.ok(html.includes('prefers-reduced-motion: reduce'));
  assert.ok(!/\[data-reveal\]\{opacity:0/.test(html.replace(/html\.js-reveal \[data-reveal\]/g, '')), 'скрытие только при наличии JS');
  const staticHtml = generate({ ...full, architecture: 'minimal' }).html;
  assert.ok(!staticHtml.includes("classList.add('js-reveal')"), 'статичная архитектура не подключает анимацию появления');
  assert.ok(staticHtml.includes('data-theme-toggle'), 'переключатель темы доступен и без анимаций');
});

test('дополнительные блоки контента выводятся только при наличии данных', () => {
  const { html, concept } = generate({ ...full,
    testimonials: [['Анна', 'Прекрасный результат']],
    team: [['Мария Иванова', 'Архитектор']],
    stats: [['12 лет', 'опыта']],
  });
  for (const id of ['testimonials', 'team', 'stats']) assert.ok(concept.homepage.sectionOrder.includes(id), `${id}: включён в порядок секций`);
  assert.match(html, /class="uds-testimonial"/);
  assert.match(html, /class="uds-team-card"/);
  assert.match(html, /class="uds-stat"/);
  assert.ok(!generate({ ...full }).html.includes('id="testimonials"'));
});

test('переключение темы и выбор стиля навигации попадают в сайт', () => {
  const { html, concept } = generate({ ...full, navStyle: 'framed' });
  assert.equal(concept.visualSystem.nav, 'framed');
  assert.match(html, /class="nav nav--framed"/);
  assert.match(html, /data-theme-toggle/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /button\.setAttribute\('aria-pressed',String\(alternate\)\)/);
  assert.match(html, /localStorage\.setItem\(key,alternate\?'alternate':'default'\)/);
  assert.match(html, /--uds-alt-bg/);
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


test('аудит производительности оценивает встроенные изображения и атрибуты загрузки', () => {
  const largePhoto = 'data:image/webp;base64,' + 'A'.repeat(420_000);
  const project = { ...full, architecture: 'editorial', images: { hero: largePhoto, heroAlt: 'Главное фото товара' } };
  const r = generate(project);
  const belowFold = '<img src="https://cdn.example.test/photo.webp" alt="Фото товара" decoding="async">';
  const audited = auditSite(r.html + belowFold, r.concept, project);
  const ids = audited.warnings.map(w => w.id);
  assert.ok(ids.includes('performance-inline-images'));
  assert.ok(ids.includes('performance-image-dimensions'));
  assert.ok(ids.includes('performance-lazy-images'));
  assert.match(r.html, /fetchpriority="high" decoding="async"/);
  assert.ok(audited.checks.some(c => c.id === 'performance-document-size'));
  assert.ok(audited.checks.some(c => c.id === 'performance-hero-priority' && c.level === 'ok'));
});


test('форма не имитирует серверную отправку через mailto и сообщает реальный статус доставки', () => {
  const mailOnly = generate({ ...full, formAction: '', contacts: { email: 'hello@example.org' } });
  assert.equal(mailOnly.audit.formDelivery, 'mailto-fallback');
  assert.ok(mailOnly.audit.warnings.some(w => w.id === 'form-delivery'));
  assert.ok(!mailOnly.html.includes('<form class="form"'), 'без HTTPS endpoint не показываем форму с mailto action');
  assert.ok(mailOnly.html.includes('mailto:hello@example.org'), 'email остаётся доступным как контакт');

  const noHandler = generate({ ...full, formAction: '', contacts: {} });
  assert.equal(noHandler.audit.formDelivery, 'not-configured');

  const endpoint = generate({ ...full, formAction: 'https://forms.example.org/submit' });
  assert.equal(endpoint.audit.formDelivery, 'endpoint-configured');
  assert.ok(endpoint.html.includes('data-form-delivery="endpoint-configured"'));
  assert.ok(endpoint.audit.warnings.some(w => w.id === 'form-delivery'), 'настройка endpoint не равна подтверждённой доставке');
});

test('композиция секций выбирается отдельно от hero и реально применяется в HTML/CSS', async () => {
  const { SECTION_LAYOUT_IDS } = await import('../src/engine/typography-layout.js');
  const layouts = new Set();
  const orders = new Set();
  for (let i = 0; i < 16; i++) {
    const result = generate({ ...full, id: `section-layout-${i}`, brand: `Разный бренд ${i}`, niche: 'кофейня' });
    const layout = result.concept.visualSystem.sectionLayout;
    assert.ok(SECTION_LAYOUT_IDS.includes(layout), layout);
    assert.ok(result.html.includes(`section-layout-${layout}`), `класс секций ${layout} не попал в HTML`);
    assert.ok(result.html.includes(`.ds-section.section-layout--${layout}`), `CSS для ${layout} не попал в HTML`);
    assert.ok(result.html.includes(`.sec--gallery.section-layout--${layout}`), `композиция фотогалереи ${layout} не попала в HTML`);
    layouts.add(layout);
    orders.add(result.concept.homepage.sectionOrder.join('|'));
  }
  assert.ok(layouts.size >= 2, `ожидалось несколько композиций секций, получено: ${[...layouts].join(', ')}`);
  assert.ok(orders.size >= 2, 'разные композиции должны менять и последовательность секций');
});


test('реальная фотография проекта автоматически используется в hero, если отдельное hero-фото не задано', () => {
  const galleryPhoto = 'data:image/webp;base64,GALLERY';
  const servicePhoto = 'data:image/webp;base64,SERVICE';
  const fromGallery = generate({
    ...full,
    architecture: 'editorial',
    images: {},
    gallery: [{ src: galleryPhoto, alt: 'Фотография интерьера', caption: 'Интерьер' }],
  });
  assert.ok(fromGallery.html.includes(`src="${galleryPhoto}" alt="Фотография интерьера" fetchpriority="high"`));
  assert.ok(fromGallery.html.includes('class="hero__figure visual"'));
  const fromService = generate({
    ...full,
    architecture: 'editorial',
    images: {},
    gallery: [],
    services: [['Услуга с фотографией', 'Описание', '', servicePhoto, 'Фотография услуги']],
  });
  assert.ok(fromService.html.includes(`src="${servicePhoto}" alt="Фотография услуги" fetchpriority="high"`));
  const explicitHero = generate({
    ...full,
    architecture: 'editorial',
    images: { hero: 'data:image/webp;base64,EXPLICIT', heroAlt: 'Главная фотография' },
    gallery: [{ src: galleryPhoto, alt: 'Фото галереи' }],
  });
  assert.ok(explicitHero.html.includes('src="data:image/webp;base64,EXPLICIT" alt="Главная фотография"'));
  assert.ok(!explicitHero.html.includes('src="' + galleryPhoto + '" alt="Фото галереи" fetchpriority="high"'));
});


test('product-first использует фото галереи на карточке товара, если hero и фото услуги не заданы', () => {
  const galleryPhoto = 'data:image/webp;base64,PRODUCT_GALLERY';
  const result = generate({
    ...full,
    architecture: 'product-first',
    images: {},
    services: [['Товар без фото', 'Описание товара', '10 000 ₽']],
    gallery: [{ src: galleryPhoto, alt: 'Главный товар в интерьере', caption: 'Главный товар' }],
  });
  assert.ok(
    result.html.includes(`src="${galleryPhoto}" alt="Главный товар в интерьере" fetchpriority="high"`),
    'product-first должен брать изображение из галереи через общий photo fallback',
  );
});


test('главное фото получает осмысленный ALT, если владелец не указал heroAlt', () => {
  const result = generate({
    ...full,
    title: 'Мастерская авторской мебели',
    images: { hero: 'data:image/webp;base64,HERO_WITHOUT_ALT', heroAlt: '' },
  });
  assert.ok(result.html.includes('alt="Мастерская авторской мебели" fetchpriority="high"'));
  assert.ok(!result.audit.warnings.some(w => w.id === 'img-alt-empty'));
});

test('явно заданный heroAlt сохраняет приоритет над автоматическим описанием', () => {
  const result = generate({
    ...full,
    title: 'Мастерская авторской мебели',
    images: { hero: 'data:image/webp;base64,HERO_WITH_ALT', heroAlt: 'Стол из натурального дуба' },
  });
  assert.ok(result.html.includes('alt="Стол из натурального дуба" fetchpriority="high"'));
});


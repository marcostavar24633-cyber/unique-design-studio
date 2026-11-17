// Генерация самодостаточной HTML-страницы по проекту и его концепции.
import { CORE_CSS } from './core-css.js';
import { ADV_CSS, BASE_CSS, BUTTON_CSS, HERO_CSS, ITEMS_CSS, NAV_CSS, PROC_CSS, tokensCss } from './css.js';
import { motifSvg } from './motif.js';
import { motionCss, motionScript } from './motion.js';
import { COMMERCE_CSS, addButton, cartPanel, catalogControls, commerceScript, itemAttrs } from './commerce.js';
import { normalizeProject } from './project.js';
import { esc } from './util.js';
import { MECHANIC_CSS, mechanicBody } from './mechanics.js';
import { dividerHtml, formsCss } from './forms.js';
import { fadeWordsHtml, textEffectCss } from './text-effects.js';

const pad = n => String(n).padStart(2, '0');

const SECTION_LAYOUT_CSS = {
  editorial: ".ds-section.section-layout--editorial:not(.sec--contact) .sec__head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--ds-border)}.ds-section.section-layout--editorial:not(.sec--contact) .sec__head h2{max-width:16ch}.ds-section.section-layout--editorial:not(.sec--contact) .sec__intro{max-width:38ch;margin:0;text-align:right}@media(min-width:760px){.sec--gallery.section-layout--editorial .gallery{grid-template-columns:repeat(12,minmax(0,1fr))}.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+1),.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+4){grid-column:span 7}.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+2),.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+3){grid-column:span 5}}",
  offset: "@media(min-width:900px){.ds-section.section-layout--offset:not(.sec--contact) .ds-container{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:clamp(24px,5vw,72px);align-items:start}.ds-section.section-layout--offset:not(.sec--contact) .sec__head{position:sticky;top:28px}.ds-section.section-layout--offset:not(.sec--contact) .sec__head+*{min-width:0}}@media(min-width:760px){.sec--gallery.section-layout--offset .gallery{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.sec--gallery.section-layout--offset .gallery li:nth-child(even){margin-top:clamp(24px,5vw,64px)}}",
  framed: ".ds-section.section-layout--framed:not(.sec--contact){background:var(--ds-surface);border-block:1px solid var(--ds-border)}.ds-section.section-layout--framed:not(.sec--contact) .ds-container{padding-block:clamp(24px,4vw,48px)}.ds-section.section-layout--framed:not(.sec--contact) .sec__head{padding-left:clamp(14px,2vw,24px);border-left:3px solid var(--ds-accent)}.sec--gallery.section-layout--framed .gallery figure{padding:10px;border:1px solid var(--ds-border);background:var(--ds-bg)}.sec--gallery.section-layout--framed .gallery img{border-radius:0}",
  quiet: ".ds-section.section-layout--quiet:not(.sec--contact){border-top:1px solid var(--ds-border)}.ds-section.section-layout--quiet:not(.sec--contact) .sec__head{margin-bottom:clamp(16px,2.5vw,28px)}.ds-section.section-layout--quiet:not(.sec--contact) .sec__head h2{font-size:clamp(1.35rem,1.1rem + 1.6vw,2.2rem);letter-spacing:-.025em}.sec--gallery.section-layout--quiet .gallery img{aspect-ratio:4/3;border-radius:0}"
};

const sectionClass = (c, id) => "ds-section sec sec--" + id + " section-layout--" + (c.vs.sectionLayout || "editorial");

/** Подключение веб-шрифтов (только при fonts: "web"). По умолчанию страница не делает внешних запросов. */
function fontLinks(fonts = []) {
  if (!fonts.length) return '';
  const q = fonts.map(f => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@${f.weights}`).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${q}&display=swap">
`;
}

function context(project, concept) {
  const vs = concept.visualSystem;
  const order = concept.homepage.sectionOrder;
  const labels = {
    about: 'О нас', items: vs.itemsLabel, advantages: 'Преимущества', process: 'Как это работает',
    gallery: vs.nicheId === 'photo' ? 'Работы' : 'Галерея', faq: 'Вопросы', contact: 'Контакты',
  };
  const titles = {
    about: project.aboutTitle || labels.about, items: project.servicesTitle || labels.items,
    advantages: project.advantagesTitle || labels.advantages, process: project.processTitle || labels.process,
    gallery: project.galleryTitle || labels.gallery, faq: project.faqTitle || 'Частые вопросы',
    contact: project.contactTitle || concept.homepage.primaryCTA,
  };
  const ctaHref = project.ctaUrl || '#contact';
  const title = project.title || project.brand || project.niche || 'Новый проект';
  const brand = project.brand || project.niche || 'Проект';
  return { p: project, concept, vs, order, labels, titles, ctaHref, title, brand, cta: concept.homepage.primaryCTA, form: leadFormSpec(project) };
}

function leadFormSpec(p) {
  // Форма показывается только при наличии реального HTTPS endpoint. mailto не является
  // надёжным form handler: для email fallback выводится обычная ссылка в контактах.
  if (p.formAction) return { action: p.formAction, extra: '' };
  return null;
}

const cta = (c, cls = '') => `<a class="ds-button${cls}" data-cta="primary" href="${esc(c.ctaHref)}">${esc(c.cta)}</a>`;
const secondary = (c, id) => (c.order.includes(id) ? `<a class="ds-button ds-button--secondary" href="#${id}">${esc(c.labels[id])}</a>` : '');
const kicker = c => (c.p.niche && c.p.niche !== c.title ? `<p class="kicker">${esc(c.p.niche)}</p>` : '');
const lede = (c, cls = 'lede') => (c.p.description ? `<p class="${cls}">${esc(c.p.description)}</p>` : '');
// Сменяющиеся фразы (эффект «исчезающий текст») идут сразу под заголовком первого экрана.
const h1 = c => `<h1 id="hero-h">${esc(c.title)}</h1>${c.vs.textEffect === 'fade-words' ? fadeWordsHtml(c.p) : ''}`;

function artStyle(p, role, index = 0) {
  const root = p.passthrough?.imageArtDirection || {};
  const entry = role === 'hero' ? root.hero : root[role]?.[index];
  const coordinate = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 50;
  const point = key => { const v = entry && entry[key] || {}; return coordinate(v.x) + '% ' + coordinate(v.y) + '%'; };
  return 'class="ds-media ds-art" style="--ds-crop-desktop:' + point('desktop') + ';--ds-crop-tablet:' + point('tablet') + ';--ds-crop-mobile:' + point('mobile') + '"';
}

function visual(c, variant = 0) {
  // На первом экране используем реальные материалы проекта в приоритетном порядке:
  // явно выбранное hero → фотография галереи → изображение первой позиции.
  // Декоративные варианты (variant > 0) остаются мотивами и не дублируют фотографию.
  if (!variant) {
    if (c.p.images.hero) {
      const alt = c.p.images.heroAlt || c.p.title || c.p.brand || c.p.niche || "Главная фотография проекта";
      return c.p.images.heroMobile ? `<picture class="ds-hero-picture"><source media="(max-width:600px)" srcset="${esc(c.p.images.heroMobile)}"><img ${artStyle(c.p, "hero")} src="${esc(c.p.images.hero)}" alt="${esc(alt)}" fetchpriority="high" decoding="async"></picture>` : `<img ${artStyle(c.p, "hero")} src="${esc(c.p.images.hero)}" alt="${esc(alt)}" fetchpriority="high" decoding="async">`;
    }
    if (c.p.gallery[0]?.src) {
      const photo = c.p.gallery[0];
      return `<img ${artStyle(c.p, "gallery", 0)} src="${esc(photo.src)}" alt="${esc(photo.alt || photo.caption || c.p.title || c.p.niche || "Фотография проекта")}" fetchpriority="high" decoding="async">`;
    }
    const firstService = c.p.services.find(item => item.image);
    if (firstService) {
      const index = c.p.services.indexOf(firstService);
      return `<img ${artStyle(c.p, "services", index)} src="${esc(firstService.image)}" alt="${esc(firstService.alt || firstService.title)}" fetchpriority="high" decoding="async">`;
    }
  }
  return motifSvg(c.vs, variant);
}

function leadForm(c, prefix) {
  if (!c.form) return '';
  const opts = c.p.services.filter(i => i.title).map(i => `<option>${esc(i.title)}</option>`).join('');
  return `<form class="form" action="${esc(c.form.action)}" method="post" data-form-delivery="endpoint-configured">
<label for="${prefix}-name">Имя<input class="ds-field" id="${prefix}-name" name="name" autocomplete="name" required></label>
<label for="${prefix}-contact">Телефон или e-mail<input class="ds-field" id="${prefix}-contact" name="contact" autocomplete="tel" required></label>
${opts ? `<label for="${prefix}-topic">${esc(c.labels.items)}<select class="ds-field" id="${prefix}-topic" name="topic" data-topic><option value="">Не выбрано</option>${opts}</select></label>` : ''}
<button class="ds-button" type="submit">${esc(c.cta)}</button>
</form>`;
}

// ---------- Навигация ----------
function nav(c) {
  const kind = c.vs.nav;
  const links = c.order.filter(id => id !== 'contact').slice(0, 5).map(id => `<li><a href="#${id}">${esc(c.labels[id])}</a></li>`).join('');
  const list = kind !== 'minimal' && links ? `<ul class="nav__links">${links}</ul>` : '';
  const withCta = kind !== 'masthead';
  let out = `<header class="site-head"><nav class="nav nav--${kind}" aria-label="Основная навигация"><a class="nav__brand" href="#top">${esc(c.brand)}</a>${list}${withCta ? `<a class="ds-button nav__cta" href="${esc(c.ctaHref)}">${esc(c.cta)}</a>` : ''}</nav>`;
  if (kind === 'category') {
    const cats = c.p.categories.length
      ? c.p.categories.map(t => `<li><a href="#items">${esc(t)}</a></li>`)
      : c.p.services.slice(0, 8).map((i, n) => `<li><a href="#item-${n}">${esc(i.title)}</a></li>`);
    if (cats.length) out += `<nav aria-label="Разделы ассортимента"><ul class="cats">${cats.join('')}</ul></nav>`;
  }
  return out + '</header>';
}

// Фото фоном первого экрана — в архитектурах, где первый экран построен на тексте, каталоге или форме.
// Фото декоративное (alt=""): смысл первого экрана передают заголовок и текст; вуаль цвета палитры
// держит контраст текста таким же, как без фото.
const HERO_PHOTO_BG = new Set(['catalog', 'split-utility', 'brutalist', 'minimal']);
function heroBackground(c) {
  if (!HERO_PHOTO_BG.has(c.vs.archetype) || !c.p.images.hero) return '';
  const img = `<img ${artStyle(c.p, 'hero')} src="${esc(c.p.images.hero)}" alt="" data-decorative="hero-bg" fetchpriority="high" decoding="async">`;
  const media = c.p.images.heroMobile ? `<picture><source media="(max-width:600px)" srcset="${esc(c.p.images.heroMobile)}">${img}</picture>` : img;
  return `<div class="hero__photo-bg" aria-hidden="true">${media}</div>`;
}

// ---------- Hero: 10 композиций ----------
const HERO = {
  'product-first'(c) {
    const it = c.p.services[0];
    // Единый выбор изображения для всех архитектур: hero → галерея → услуга → мотив.
    const media = visual(c);
    const body = it ? `<div class="spotlight__body"><p class="spotlight__label">${esc(c.labels.items)}</p><h2>${esc(it.title)}</h2>${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.price ? `<p class="price">${esc(it.price)}</p>` : ''}<a class="ds-button ds-button--secondary" href="#item-0">Подробнее</a></div>` : '';
    return `<div class="ds-container hero__grid"><div class="hero__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}${secondary(c, 'items')}</div></div><article class="spotlight ds-card"><div class="spotlight__media">${media}</div>${body}</article></div>`;
  },
  editorial(c) {
    const aside = c.p.mainOffer ? `<p>${esc(c.p.mainOffer)}</p>` : '';
    return `<div class="ds-container">${kicker(c)}${h1(c)}<div class="hero__cols">${lede(c, 'lede dropcap')}<div class="hero__aside">${aside}<div class="actions">${cta(c)}</div></div></div><figure class="hero__figure visual">${visual(c)}</figure></div>`;
  },
  immersive(c) {
    return `<div class="hero__bg" data-parallax>${visual(c)}</div><div class="hero__scrim"></div><div class="ds-container hero__content">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}${c.order[0] !== 'contact' ? secondary(c, c.order[0]) : ''}</div></div>`;
  },
  asymmetric(c) {
    const tag = c.p.advantages[0]?.title || c.p.mainOffer;
    return `<div class="ds-container hero__canvas">${h1(c)}<div class="visual">${visual(c)}</div><div class="hero__note">${kicker(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${tag ? `<p class="hero__tag">${esc(tag)}</p>` : ''}</div>`;
  },
  catalog(c) {
    const tiles = c.p.categories.length
      ? c.p.categories.slice(0, 8).map((t, n) => `<li><a href="#items"><span class="n">${pad(n + 1)}</span><span>${esc(t)}</span></a></li>`)
      : c.p.services.slice(0, 8).map((i, n) => `<li><a href="#item-${n}"><span class="n">${pad(n + 1)}</span><span>${esc(i.title)}</span></a></li>`);
    const search = c.p.services.length >= 4
      ? `<form class="search" role="search" hidden data-search><label class="vh" for="q">Поиск по разделу «${esc(c.labels.items)}»</label><input class="ds-field" type="search" id="q" placeholder="Поиск: ${esc(c.labels.items.toLowerCase())}" autocomplete="off"></form><p class="search__status" role="status" aria-live="polite" data-search-status></p>` : '';
    return `<div class="ds-container hero__wrap"><div class="hero__head">${kicker(c)}${h1(c)}${lede(c)}${search}<div class="actions">${cta(c)}</div></div>${tiles.length ? `<ul class="tiles" role="list">${tiles.join('')}</ul>` : ''}</div>`;
  },
  'split-utility'(c) {
    const checks = c.p.advantages.slice(0, 3).filter(a => a.title).map(a => `<li>${esc(a.title)}</li>`).join('');
    let tool;
    if (c.form) tool = leadForm(c, 'hero');
    else {
      const picks = c.p.services.slice(0, 5).map((i, n) => `<li><a href="#item-${n}">${esc(i.title)}</a></li>`).join('');
      tool = `${picks ? `<ul class="picker">${picks}</ul>` : c.p.contactText ? `<p>${esc(c.p.contactText)}</p>` : ''}${cta(c)}`;
    }
    const title = c.form ? c.cta : c.p.services.length ? `${c.labels.items}: с чего начать` : c.cta;
    return `<div class="ds-container hero__split"><div class="hero__copy">${kicker(c)}${h1(c)}${lede(c)}${checks ? `<ul class="checks">${checks}</ul>` : ''}${c.form ? `<div class="actions">${cta(c, ' ds-button--secondary')}</div>` : ''}</div><div class="tool ds-card"><h2 class="tool__title">${esc(title)}</h2>${tool}</div></div>`;
  },
  storytelling(c) {
    const chapters = c.order.map((id, n) => `<li><a href="#${id}"><span class="n">${pad(n + 2)}</span><span>${esc(c.labels[id])}</span></a></li>`).join('');
    return `<div class="ds-container hero__story"><div><p class="chapter-no">01${c.p.niche ? ' — ' + esc(c.p.niche) : ''}</p>${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div><nav aria-label="Главы страницы"><ol class="chapters">${chapters}</ol></nav></div><div class="hero__band">${visual(c)}</div>`;
  },
  'modular-grid'(c) {
    const entries = c.p.services.slice(0, 3);
    const cells = entries.map((i, n) => `<a class="bento__cell bento__entry" href="#item-${n}"><span class="n">${pad(n + 1)}</span><strong>${esc(i.title)}</strong>${i.text ? `<span>${esc(i.text)}</span>` : ''}</a>`).join('');
    return `<div class="ds-container"><div class="bento bento--n${entries.length}"><div class="bento__cell bento__head">${kicker(c)}${h1(c)}${lede(c)}</div><div class="bento__cell bento__visual">${visual(c)}</div>${cells}<a class="bento__cell bento__cta" data-cta="primary" href="${esc(c.ctaHref)}"><span>${esc(c.cta)}</span><span aria-hidden="true">→</span></a></div></div>`;
  },
  brutalist(c) {
    const index = c.order.map((id, n) => `<li><a href="#${id}"><span class="n">${pad(n + 1)}</span>${esc(c.labels[id])}</a></li>`).join('');
    return `<div class="hero__frame"><div class="brut__top"><span>${esc(c.brand)}</span>${c.p.niche ? `<span>${esc(c.p.niche)}</span>` : ''}</div><div class="brut__main">${h1(c)}<div class="brut__side">${lede(c)}${cta(c)}</div></div><nav aria-label="Разделы страницы"><ol class="brut__index">${index}</ol></nav></div>`;
  },
  minimal(c) {
    const proof = c.p.advantages.slice(0, 3).filter(a => a.title).map(a => `<li>${esc(a.title)}</li>`).join('');
    return `<div class="ds-container hero__stack">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div>${proof ? `<ul class="proof">${proof}</ul>` : ''}</div>`;
  },
};

// ---------- Секции ----------
const wrap = (c, id, inner, intro = '') => `<section id="${id}" class="${sectionClass(c, id)}" aria-labelledby="${id}-h"><div class="ds-container"><header class="sec__head"><h2 id="${id}-h">${esc(c.titles[id])}</h2>${intro ? `<p class="sec__intro">${esc(intro)}</p>` : ''}</header>${inner}</div></section>`;

const SECTION = {
  about: c => `<section id="about" class="${sectionClass(c, 'about')}" aria-labelledby="about-h"><div class="ds-container"><header class="sec__head"><h2 id="about-h">${esc(c.titles.about)}</h2></header><p class="about__text" data-reveal>${esc(c.p.aboutText)}</p></div></section>`,
  items(c) {
    const v = c.vs.variants.items;
    const mech = c.vs.variants.itemsMechanic || 'none';
    const li = c.p.services.map((i, n) => {
      const mobile = c.p.passthrough?.imageArtDirection?.mobileSources?.services?.[n];
      const img = mobile ? `<picture><source media="(max-width:600px)" srcset="${esc(mobile)}"><img ${artStyle(c.p, "services", n)} src="${esc(i.image)}" alt="${esc(i.alt || i.title)}" loading="lazy" decoding="async"></picture>` : `<img ${artStyle(c.p, "services", n)} src="${esc(i.image)}" alt="${esc(i.alt || i.title)}" loading="lazy" decoding="async">`;
      const media = i.image ? `<div class="item__media">${img}</div>` : '';
      const shop = c.vs.commerce?.tools || c.vs.commerce?.cart;
      const parts = { media, title: `<h3>${esc(i.title)}</h3>`, text: i.text ? `<p>${esc(i.text)}</p>` : '', price: i.price ? `<p class="price">${esc(i.price)}</p>` : '', action: c.vs.commerce?.cart ? addButton(i, n) : '' };
      const flip = mech === 'flip' && media && parts.text;
      // Переворот открывается и с клавиатуры: карточка получает фокус, а :focus-within поворачивает её.
      const attrs = `${flip ? ' tabindex="0"' : ''}${mech === 'stack' ? ` style="--stack-i:${n}"` : ''}`;
      return `<li class="item${flip ? ' item--flip' : ''}" id="item-${n}"${shop ? itemAttrs(i) : ''}${attrs} data-reveal>${mechanicBody(mech, parts)}</li>`;
    }).join('');
    const list = `<ul class="items items--${v}${mech !== 'none' ? ` items--mech-${mech}` : ''}" role="list">${li}</ul>`;
    const body = mech === 'rail'
      ? `<div class="rail" role="region" aria-label="${esc(c.labels.items)}: прокрутите вбок" tabindex="0">${list}</div><p class="rail__hint" aria-hidden="true">Листайте вбок →</p>`
      : list;
    return wrap(c, 'items', `${c.vs.commerce?.tools ? catalogControls(c.p) : ''}${body}`, c.p.servicesIntro);
  },
  advantages(c) {
    const li = c.p.advantages.map(a => `<li data-reveal><h3>${esc(a.title)}</h3>${a.text ? `<p>${esc(a.text)}</p>` : ''}</li>`).join('');
    return wrap(c, 'advantages', `<ul class="adv adv--${c.vs.variants.advantages}" role="list">${li}</ul>`, c.p.advantagesIntro);
  },
  process(c) {
    const li = c.p.process.map(a => `<li data-reveal><h3>${esc(a.title)}</h3>${a.text ? `<p>${esc(a.text)}</p>` : ''}</li>`).join('');
    return wrap(c, 'process', `<ol class="proc proc--${c.vs.variants.process}" role="list">${li}</ol>`);
  },
  gallery(c) {
    const li = c.p.gallery.map((g, n) => { const mobile = c.p.passthrough?.imageArtDirection?.mobileSources?.gallery?.[n]; const img = mobile ? `<picture><source media="(max-width:600px)" srcset="${esc(mobile)}"><img ${artStyle(c.p, "gallery", n)} src="${esc(g.src)}" alt="${esc(g.alt || g.caption)}" loading="lazy" decoding="async"></picture>` : `<img ${artStyle(c.p, "gallery", n)} src="${esc(g.src)}" alt="${esc(g.alt || g.caption)}" loading="lazy" decoding="async">`; return `<li data-reveal><figure>${img}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''} </figure></li>`; }).join('');
    return wrap(c, 'gallery', `<ul class="gallery" role="list">${li}</ul>`);
  },
  faq(c) {
    const d = c.p.faqs.map(f => `<details><summary>${esc(f.title)}</summary><p>${esc(f.text)}</p></details>`).join('');
    return wrap(c, 'faq', `<div class="faq">${d}</div>`);
  },
  contact(c) {
    const k = c.p.contacts, rows = [];
    if (k.phone) rows.push(`<li><span>Телефон</span><a href="tel:${esc(k.phone.replace(/[^\d+]/g, ''))}">${esc(k.phone)}</a></li>`);
    if (k.email) rows.push(`<li><span>E-mail</span><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></li>`);
    if (k.address) rows.push(`<li><span>Адрес</span>${esc(k.address)}</li>`);
    if (k.hours) rows.push(`<li><span>Часы работы</span>${esc(k.hours)}</li>`);
    const form = leadForm(c, 'contact');
    const ext = c.p.ctaUrl && !c.p.ctaUrl.startsWith('#') ? `<div class="actions">${cta(c)}</div>` : '';
    return `<section id="contact" class="${sectionClass(c, 'contact')}" aria-labelledby="contact-h"><div class="ds-container contact${form ? ' contact--two' : ''}"><div><h2 id="contact-h">${esc(c.titles.contact)}</h2>${c.p.contactText ? `<p class="lede">${esc(c.p.contactText)}</p>` : ''}${rows.length ? `<ul class="contact__list">${rows.join('')}</ul>` : ''}${ext}</div>${form}</div></section>`;
  },
};

// ---------- Скрипт страницы: только нужные фрагменты ----------
function script(c) {
  const parts = [];
  const reduce = `matchMedia('(prefers-reduced-motion: reduce)').matches`;
  if (c.vs.motionPlan?.mechanics.includes('scroll-reveal')) parts.push(`if('IntersectionObserver'in window&&!${reduce}){document.documentElement.classList.add('js-reveal');var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});document.querySelectorAll('[data-reveal]').forEach(function(el){io.observe(el)})}`);
  if (c.vs.motionPlan?.mechanics.includes('parallax')) parts.push(`var px=document.querySelector('[data-parallax]');if(px&&!${reduce}){var tick=false;addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){px.style.transform='translate3d(0,'+Math.min(scrollY*.08,40)+'px,0)';tick=false})},{passive:true})}`);
  if (c.vs.archetype === 'catalog' && c.p.services.length >= 4) parts.push(`var sf=document.querySelector('[data-search]');if(sf){sf.hidden=false;var st=document.querySelector('[data-search-status]');sf.addEventListener('submit',function(e){e.preventDefault();document.getElementById('items').scrollIntoView()});sf.querySelector('input').addEventListener('input',function(e){var q=e.target.value.trim().toLowerCase(),n=0;var items=document.querySelectorAll('#items .item'),tools=document.querySelector('[data-catalog-tools]');if(tools){items.forEach(function(li){if(!q||li.textContent.toLowerCase().indexOf(q)>-1)n++});tools.dispatchEvent(new CustomEvent('uds:catalog-search'));}else{items.forEach(function(li){var ok=!q||li.textContent.toLowerCase().indexOf(q)>-1;li.hidden=!ok;if(ok)n++})}if(!tools)st.textContent=q?'Найдено: '+n:''})}`);
  if ((c.vs.commerce?.tools || c.vs.commerce?.cart) && c.order.includes('items')) parts.push(commerceScript(c.p));
  const motion = motionScript(c.vs.motionPlan);
  if (motion) parts.push(motion);
  return parts.length ? `<script>(function(){${parts.join(';')}})();</script>` : '';
}

function jsonLd(c) {
  const k = c.p.contacts;
  const data = { '@context': 'https://schema.org', '@type': 'Organization', name: c.brand };
  if (c.p.description) data.description = c.p.description;
  if (k.phone) data.telephone = k.phone;
  if (k.email) data.email = k.email;
  if (k.address) data.address = k.address;
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

export function renderCss(concept) {
  const vs = concept.visualSystem;
  const used = concept.homepage.sectionOrder;
  return [
    CORE_CSS, tokensCss(vs), BASE_CSS, BUTTON_CSS[vs.button.id], NAV_CSS[vs.nav], HERO_CSS[vs.archetype], SECTION_LAYOUT_CSS[vs.sectionLayout || 'editorial'],
    '.ds-art{object-position:var(--ds-crop-desktop,50% 50%)}@media(max-width:900px){.ds-art{object-position:var(--ds-crop-tablet,var(--ds-crop-desktop,50% 50%))}}@media(max-width:600px){.ds-art{object-position:var(--ds-crop-mobile,var(--ds-crop-tablet,var(--ds-crop-desktop,50% 50%)))}}',
    // Фото фоном первого экрана: вуаль цвета фона держит контраст текста. Без color-mix — почти сплошной фон.
    HERO_PHOTO_BG.has(vs.archetype) ? '.hero.has-photo-bg{isolation:isolate;overflow:hidden}.hero__photo-bg{position:absolute;inset:0;z-index:-1}.hero__photo-bg img,.hero__photo-bg picture{display:block;width:100%;height:100%;object-fit:cover}.hero__photo-bg::after{content:"";position:absolute;inset:0;background:var(--ds-bg);opacity:.9}@supports (background:color-mix(in srgb,red 50%,transparent)){.hero__photo-bg::after{opacity:1;background:linear-gradient(90deg,color-mix(in srgb,var(--ds-bg) 92%,transparent),color-mix(in srgb,var(--ds-bg) 78%,transparent))}}' : '',
    (vs.commerce?.tools || vs.commerce?.cart) && used.includes('items') ? COMMERCE_CSS : '',
    used.includes('items') ? ITEMS_CSS[vs.variants.items] : '',
    used.includes('items') ? MECHANIC_CSS[vs.variants.itemsMechanic || 'none'] || '' : '',
    vs.forms ? formsCss(vs.forms) : '',
    textEffectCss(vs.textEffect),
    used.includes('advantages') ? ADV_CSS[vs.variants.advantages] : '',
    used.includes('process') ? PROC_CSS[vs.variants.process] : '',
    used.includes('items') ? `.item__media{aspect-ratio:4/3;overflow:hidden;background:var(--u-tint)}.item__media .ds-media{display:block;width:100%;height:100%;object-fit:cover}.items--cards .item__media{margin:calc(clamp(18px,2.4vw,28px)*-1) calc(clamp(18px,2.4vw,28px)*-1) 16px}.items--bento .item__media{margin:calc(clamp(18px,2.6vw,32px)*-1) calc(clamp(18px,2.6vw,32px)*-1) 16px}.items--rules .item__media,.items--numbered .item__media{max-width:420px;border-radius:var(--ds-radius-md)}` : '',
    // Motion CSS подключается последним: стеклянные поверхности сохраняются поверх базовых стилей карточек.
    motionCss(vs.motionPlan),
  ].join('\n').replace(/\n\s*/g, '');
}

/** Возвращает полный HTML главной страницы. */
export function renderSite(input, concept) {
  const project = normalizeProject(input);
  const c = context(project, concept);
  const vs = c.vs;
  const desc = project.seoDescription || project.description || project.mainOffer || '';
  const pageTitle = project.seoTitle || (c.title === c.brand ? c.brand : `${c.title} — ${c.brand}`);
  // Разделитель секций — декоративная линия формы бренда (aria-hidden), только между секциями.
  const sections = c.order.map(id => SECTION[id](c)).join('\n' + dividerHtml(c.vs.forms?.divider) + '\n');
  const foot = [project.contacts.phone, project.contacts.email, project.contacts.address].filter(Boolean).map(esc).join(' · ');
  return `<!doctype html>
<html lang="${esc(project.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">` : ''}
<meta property="og:title" content="${esc(pageTitle)}">
${desc ? `<meta property="og:description" content="${esc(desc)}">` : ''}
<meta property="og:type" content="website">
<meta name="theme-color" content="${vs.palette.bg}">
<meta name="generator" content="Unique Design Studio">
${fontLinks(vs.typography.webFonts)}<style>${renderCss(concept)}</style>
${jsonLd(c)}
</head>
<body id="top" class="arch-${vs.archetype} nav-${vs.nav} section-layout-${vs.sectionLayout || 'editorial'}">
<a class="skip" href="#main">Перейти к содержимому</a>
${nav(c)}
<main id="main">
<section class="hero hero--${vs.archetype} is-${vs.placement}${heroBackground(c) ? ' has-photo-bg' : ''}" aria-labelledby="hero-h">${heroBackground(c)}${HERO[vs.archetype](c)}</section>
${sections}
</main>
<footer class="foot"><div class="ds-container"><span>${esc(c.brand)}${project.niche ? ' — ' + esc(project.niche) : ''}</span>${foot ? `<span>${foot}</span>` : ''}</div></footer>
${vs.commerce?.cart && c.order.includes('items') ? cartPanel(project) : ''}
${script(c)}
</body>
</html>
`;
}

// Генерация самодостаточной HTML-страницы по проекту и его концепции.
import { CORE_CSS } from './core-css.js';
import { ADV_CSS, BASE_CSS, BUTTON_CSS, HERO_CSS, ITEMS_CSS, NAV_CSS, PROC_CSS, tokensCss } from './css.js';
import { motifSvg } from './motif.js';
import { motionCss, motionScript } from './motion.js';
import { COMMERCE_CSS, addButton, cartPanel, catalogControls, commerceScript, itemAttrs } from './commerce.js';
import { normalizeProject } from './project.js';
import { canvasBlocksHtml, canvasEditScope, canvasEditsRuntime, canvasElementsHtml, canvasMovesRuntime, canvasOrderRuntime, canvasResponsiveEditsRuntime } from './canvas.js';
import { esc, slugify } from './util.js';
import { MECHANIC_CSS, mechanicBody } from './mechanics.js';
import { formsCss } from './forms.js';
import { fadeWordsHtml, textEffectCss } from './text-effects.js';
import { directScene } from './cinematic/scene-director.js';
import { sceneMarkup, sceneCss, sceneScript } from './cinematic/scene-runtime.js';
import { cinematicLayersCss, cinematicLightMarkup } from './cinematic/visual-layers.js';
import { transitionCss, transitionHtml } from './cinematic/transitions.js';
import { sectionBackdropsCss } from './section-backdrops.js';
import { cardShapeCss, photoCompositionCss, revealCss, sectionCompositionsCss } from './variety.js';
import { cardEffectCss, effectsScript, heroEffectCss, heroEffectMarkup, heroMarqueeHtml } from './effects.js';
import { EXTRA_LAYOUT_CSS, LAYOUT_ORDER_FAMILY, buttonAnimationCss, buttonAnimationScript, textAnimationCss, typeStyleCss } from './typography-layout.js';
import { createVisualIdentity } from '../visual-identity.js';
import { contrast, ensureContrast, readableOn, mix } from './color.js';
import { TEXT_FIT_CSS, textFitScript } from './text-fit.js';

const pad = n => String(n).padStart(2, '0');

const SECTION_LAYOUT_CSS = {
  editorial: ".ds-section.section-layout--editorial:not(.sec--contact) .sec__head{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding-bottom:16px;border-bottom:1px solid var(--ds-border)}.ds-section.section-layout--editorial:not(.sec--contact) .sec__head h2{max-width:16ch}.ds-section.section-layout--editorial:not(.sec--contact) .sec__intro{max-width:38ch;margin:0;text-align:left}@media(min-width:760px){.sec--gallery.section-layout--editorial .gallery{grid-template-columns:repeat(12,minmax(0,1fr))}.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+1),.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+4){grid-column:span 7}.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+2),.sec--gallery.section-layout--editorial .gallery li:nth-child(4n+3){grid-column:span 5}}",
  offset: "@media(min-width:900px){.ds-section.section-layout--offset:not(.sec--contact) .ds-container{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:clamp(24px,5vw,72px);align-items:start}.ds-section.section-layout--offset:not(.sec--contact) .sec__head{position:sticky;top:28px}.ds-section.section-layout--offset:not(.sec--contact) .sec__head+*{min-width:0}}@media(min-width:760px){.sec--gallery.section-layout--offset .gallery{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.sec--gallery.section-layout--offset .gallery li:nth-child(even){margin-top:clamp(24px,5vw,64px)}}",
  framed: ".ds-section.section-layout--framed:not(.sec--contact){background:var(--ds-surface);border-block:1px solid var(--ds-border)}.ds-section.section-layout--framed:not(.sec--contact) .ds-container{padding-block:clamp(24px,4vw,48px)}.ds-section.section-layout--framed:not(.sec--contact) .sec__head{padding-left:clamp(14px,2vw,24px);border-left:3px solid var(--ds-accent)}.sec--gallery.section-layout--framed .gallery figure{padding:10px;border:1px solid var(--ds-border);background:var(--ds-bg)}",
  quiet: ".ds-section.section-layout--quiet:not(.sec--contact){border-top:1px solid var(--ds-border)}.ds-section.section-layout--quiet:not(.sec--contact) .sec__head{margin-bottom:clamp(16px,2.5vw,28px)}.ds-section.section-layout--quiet:not(.sec--contact) .sec__head h2{font-size:clamp(1.35rem,1.1rem + 1.6vw,2.2rem);letter-spacing:-.025em}.sec--gallery.section-layout--quiet .gallery img{aspect-ratio:4/3}"
};

const sectionClass = (c, id) => "ds-section sec sec--" + id + " section-layout--" + (c.vs.sectionLayout || "editorial") + (c.vs.sectionCompositions?.[id] ? " section-composition--" + c.vs.sectionCompositions[id] : "");
const itemAnchor = item => `item-${slugify(item?.id || item?.title || 'item')}`;
const localizedItemsLabel = (lang, label) => {
  if (!String(lang || '').toLowerCase().startsWith('en')) return label;
  const translations = {
    'Каталог': 'Catalog', 'Ассортимент': 'Products', 'Меню': 'Menu', 'Услуги': 'Services',
    'Направления': 'Services', 'Что делаем': 'What we do', 'Что ремонтируем': 'What we repair',
    'Программа': 'Program', 'Возможности': 'Features', 'Форматы': 'Packages', 'Коллекции': 'Collections',
  };
  return translations[label] || 'Services';
};
const itemLink = (c, item, content, attributes = '') => c.order.includes('items')
  ? `<a href="#${itemAnchor(item)}"${attributes}>${content}</a>`
  : `<span${attributes}>${content}</span>`;

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
  const copy = key => systemCopy(project.lang, key);
  const labels = {
    about: copy('about'), items: localizedItemsLabel(project.lang, vs.itemsLabel), advantages: copy('advantages'), process: copy('process'),
    pricing: project.lang.startsWith('en') ? 'Pricing and packages' : 'Тарифы и пакеты',
    cases: project.lang.startsWith('en') ? 'Selected work' : 'Кейсы и результаты',
    quiz: project.lang.startsWith('en') ? 'Find the right option' : 'Подберите подходящий вариант',
    gallery: vs.nicheId === 'photo' ? copy('portfolioWork') : copy('gallery'), faq: copy('faq'), contact: copy('contactSection'),
    testimonials: project.lang.startsWith('en') ? 'Testimonials' : 'Отзывы', team: project.lang.startsWith('en') ? 'Team' : 'Команда', stats: project.lang.startsWith('en') ? 'By the numbers' : 'Факты и цифры',
  };
  const titles = {
    about: project.aboutTitle || labels.about, items: project.servicesTitle || labels.items,
    advantages: project.advantagesTitle || labels.advantages, process: project.processTitle || labels.process,
    gallery: project.galleryTitle || labels.gallery, faq: project.faqTitle || labels.faq,
    pricing: project.pricingTitle || labels.pricing, cases: project.casesTitle || labels.cases,
    quiz: project.quizTitle || labels.quiz,
    contact: project.contactTitle || (project.lang.startsWith('en') ? labels.contact : concept.homepage.primaryCTA),
    testimonials: project.lang.startsWith('en') ? 'What clients say' : 'Отзывы клиентов', team: project.lang.startsWith('en') ? 'Our team' : 'Наша команда', stats: project.lang.startsWith('en') ? 'Our track record' : 'В цифрах',
  };
  const siteStates = project.site?.fieldStates || {};
  const pageStates = project.fieldStates || {};
  const ctaUnavailable = pageStates.ctaUrl === 'manual' && !project.ctaUrl || pageStates.cta === 'manual' && !project.cta;
  const ctaTextHidden = pageStates.cta === 'hidden' || (pageStates.cta !== 'manual' && siteStates.cta === 'hidden');
  const ctaUrlHidden = pageStates.ctaUrl === 'hidden' || (pageStates.ctaUrl !== 'manual' && siteStates.ctaUrl === 'hidden');
  const ctaExplicitlyHidden = ctaTextHidden || ctaUrlHidden;
  const ctaHrefCandidate = project.ctaUrl || (ctaUnavailable || ctaExplicitlyHidden ? '' : '#contact');
  const hiddenSections = new Set([...(Array.isArray(project.passthrough?.hiddenSections) ? project.passthrough.hiddenSections : []), ...Object.keys(project.fieldStates || {}).filter(key => key.startsWith('sections.') && project.fieldStates[key] === 'hidden').map(key => key.slice(9))]);
  const ctaTarget = ctaHrefCandidate.startsWith('#') ? ctaHrefCandidate.slice(1) : '';
  const availableAnchors = new Set(['top', 'main', 'hero-h']);
  for (const id of order) { availableAnchors.add(id); availableAnchors.add(`${id}-h`); }
  if (order.includes('items')) for (const item of project.services) availableAnchors.add(itemAnchor(item));
  const invalidCtaTarget = Boolean(ctaTarget && !availableAnchors.has(ctaTarget));
  const ctaFallback = order.includes('contact') ? '#contact'
    : project.contacts.phone ? `tel:${project.contacts.phone.replace(/[^+\\d]/g, '')}`
      : project.contacts.email ? `mailto:${project.contacts.email}` : '';
  const ctaHref = ctaExplicitlyHidden || ctaUnavailable || (ctaTarget && hiddenSections.has(ctaTarget)) ? ''
    : invalidCtaTarget ? ctaFallback : ctaHrefCandidate;
  const title = project.title || project.brand || project.niche || 'Новый проект';
  const brand = project.brand || project.niche || 'Проект';
  return { p: project, concept, vs, order, labels, titles, ctaHref, invalidCtaTarget, title, brand, cta: concept.homepage.primaryCTA, form: leadFormSpec(project) };
}

function leadFormSpec(p) {
  // Форма показывается только при наличии реального HTTPS endpoint. mailto не является
  // надёжным form handler: для email fallback выводится обычная ссылка в контактах.
  if (p.formAction) return { action: p.formAction, extra: '' };
  return null;
}

const SYSTEM_COPY = {
  ru: {
    skip: 'Перейти к содержимому', name: 'Имя', contact: 'Телефон или e-mail', unselected: 'Не выбрано', phone: 'Телефон', email: 'E-mail', address: 'Адрес', hours: 'Часы работы', call: 'Позвонить', telegram: 'Telegram', max: 'MAX',
    more: 'Показать ещё', moreDetails: 'Подробнее', searchIn: 'Поиск по разделу', search: 'Поиск', categories: 'Разделы ассортимента', chapters: 'Главы страницы', pageSections: 'Разделы страницы',
    about: 'О нас', advantages: 'Преимущества', process: 'Как это работает', faq: 'Вопросы', gallery: 'Галерея', items: 'Услуги', contactSection: 'Контакты',
    mainPhoto: 'Главная фотография проекта', projectPhoto: 'Фотография проекта', portfolioWork: 'Работа из портфолио', featuredWork: 'Главная работа',
    galleryScroll: 'Галерея фотографий. Прокручивайте по горизонтали, чтобы увидеть остальные.', scrollHint: 'Листайте вбок →', flipHint: 'Наведите курсор или выберите карточку, чтобы узнать больше.',
    sending: 'Отправляем заявку…', sent: 'Заявка отправлена.', failed: 'Не удалось отправить заявку. Проверьте соединение и попробуйте ещё раз.',
  },
  en: {
    skip: 'Skip to content', name: 'Name', contact: 'Phone or email', unselected: 'Not selected', phone: 'Phone', email: 'Email', address: 'Address', hours: 'Hours', call: 'Call', telegram: 'Telegram', max: 'MAX',
    more: 'Show more', moreDetails: 'More details', searchIn: 'Search in', search: 'Search', categories: 'Catalog categories', chapters: 'Page chapters', pageSections: 'Page sections',
    about: 'About', advantages: 'Benefits', process: 'How it works', faq: 'Questions', gallery: 'Gallery', items: 'Services', contactSection: 'Contact',
    mainPhoto: 'Main project photo', projectPhoto: 'Project photo', portfolioWork: 'Portfolio work', featuredWork: 'Featured work',
    galleryScroll: 'Photo gallery. Scroll horizontally to see the remaining images.', scrollHint: 'Scroll horizontally →', flipHint: 'Hover or focus the card to learn more.',
    sending: 'Sending your request…', sent: 'Your request was sent.', failed: 'The request could not be sent. Check your connection and try again.',
  },
};
const systemCopy = (lang, key) => (SYSTEM_COPY[String(lang || '').toLowerCase().split('-')[0]] || SYSTEM_COPY.ru)[key];

const cta = (c, cls = '') => c.ctaHref ? `<a class="ds-button${cls}" data-cta="primary" href="${esc(c.ctaHref)}">${esc(c.cta)}</a>` : '';
const contactActions = (c, inNav = false) => {
  const k = c.p.contacts;
  const digits = String(k.phone || '').replace(/\D/g, '');
  const links = [];
  if (k.telegram) links.push(`<a class="ds-button ds-button--secondary ds-contact-action" data-contact-action="telegram" href="${esc(k.telegram)}" target="_blank" rel="noopener noreferrer">${esc(systemCopy(c.p.lang, 'telegram'))}</a>`);
  if (k.max) links.push(`<a class="ds-button ds-button--secondary ds-contact-action" data-contact-action="max" href="${esc(k.max)}" target="_blank" rel="noopener noreferrer">${esc(systemCopy(c.p.lang, 'max'))}</a>`);
  if (digits.length >= 5) links.push(`<a class="ds-button ds-button--secondary ds-contact-action" data-contact-action="call" href="tel:${esc(k.phone.replace(/[^+\d]/g, ''))}">${esc(systemCopy(c.p.lang, 'call'))}</a>`);
  return links.length ? `<div class="contact-actions${inNav ? ' nav__contact-actions' : ''}" aria-label="${c.p.lang.startsWith('en') ? 'Contact options' : 'Способы связи'}">${links.join('')}</div>` : '';
};
const secondary = (c, id) => (c.order.includes(id) ? `<a class="ds-button ds-button--secondary" href="#${id}">${esc(c.labels[id])}</a>` : '');
const kicker = c => (c.p.niche && c.p.niche !== c.title ? `<p class="kicker">${esc(c.p.niche)}</p>` : '');
const lede = (c, cls = 'lede') => (c.p.description ? `<p class="${cls}">${esc(c.p.description)}</p>` : '');
// Сменяющиеся фразы (эффект «исчезающий текст») идут сразу под заголовком первого экрана.
const h1 = c => `<h1 id="hero-h">${esc(c.title)}</h1>${c.vs.textEffect === 'fade-words' ? fadeWordsHtml(c.p) : ''}${heroMarqueeHtml(c.vs.effects, c.p)}`;

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
      const alt = c.p.images.heroAlt || c.p.title || c.p.brand || c.p.niche || systemCopy(c.p.lang, 'mainPhoto');
      return c.p.images.heroMobile ? `<picture class="ds-hero-picture"><source media="(max-width:600px)" srcset="${esc(c.p.images.heroMobile)}"><img ${artStyle(c.p, "hero")} src="${esc(c.p.images.hero)}" alt="${esc(alt)}" fetchpriority="high" decoding="async"></picture>` : `<img ${artStyle(c.p, "hero")} src="${esc(c.p.images.hero)}" alt="${esc(alt)}" fetchpriority="high" decoding="async">`;
    }
    if (c.p.gallery[0]?.src) {
      const photo = c.p.gallery[0];
      return `<img ${artStyle(c.p, "gallery", 0)} src="${esc(photo.src)}" alt="${esc(photo.alt || photo.caption || c.p.title || c.p.niche || systemCopy(c.p.lang, 'projectPhoto'))}" fetchpriority="high" decoding="async">`;
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
<label for="${prefix}-name">${systemCopy(c.p.lang, 'name')}<input class="ds-field" id="${prefix}-name" name="name" autocomplete="name" required></label>
<label for="${prefix}-contact">${systemCopy(c.p.lang, 'contact')}<input class="ds-field" id="${prefix}-contact" name="contact" autocomplete="tel" required></label>
${opts ? `<label for="${prefix}-topic">${esc(c.labels.items)}<select class="ds-field" id="${prefix}-topic" name="topic" data-topic><option value="">${systemCopy(c.p.lang, 'unselected')}</option>${opts}</select></label>` : ''}
<input type="hidden" name="quiz_summary" data-quiz-summary>
<button class="ds-button" type="submit">${esc(c.cta)}</button>
<p class="form__status" data-form-status role="status" aria-live="polite" hidden></p>
</form>`;
}

// ---------- Навигация ----------
function nav(c) {
  const kind = c.vs.nav;
  const links = c.order.filter(id => id !== 'contact').slice(0, 5).map(id => `<li><a href="#${id}">${esc(c.labels[id])}</a></li>`).join('');
  const list = kind !== 'minimal' && links ? `<ul class="nav__links">${links}</ul>` : '';
  const withCta = kind !== 'masthead';
  const brandMark = c.p.site.logo ? `<img class="nav__logo" src="${esc(c.p.site.logo)}" alt="" style="max-width:150px;max-height:40px;width:auto;height:auto;object-fit:contain">` : '';
  const brandText = `<span>${esc(c.brand)}</span>`;
  const brandNote = c.p.site.header.tagline ? `<small class="nav__tagline">${esc(c.p.site.header.tagline)}</small>` : '';
  const brand = `<a class="nav__brand" href="#top">${brandMark}${brandText}${brandNote}</a>`;
  const themeLabel = c.p.lang.startsWith('en') ? 'Switch light or dark theme' : 'Переключить светлую или тёмную тему';
  let out = `<header class="site-head"><nav class="nav nav--${kind}" aria-label="${c.p.lang.startsWith('en') ? 'Main navigation' : 'Основная навигация'}">${brand}${list}${withCta && c.ctaHref ? `<a class="ds-button nav__cta" data-cta="primary" href="${esc(c.ctaHref)}">${esc(c.p.site.header.ctaLabel || c.cta)}</a>` : ''}${contactActions(c, true)}<button class="ds-theme-toggle" type="button" data-theme-toggle aria-label="${themeLabel}" aria-pressed="false" title="${themeLabel}"><span aria-hidden="true">◐</span><span class="ds-theme-toggle__label">${c.p.lang.startsWith('en') ? 'Theme' : 'Тема'}</span></button></nav>`;
  if (kind === 'category') {
    const cats = c.p.categories.length
      ? c.p.categories.map(t => `<li>${c.order.includes('items') ? `<a href="#items">${esc(t)}</a>` : `<span>${esc(t)}</span>`}</li>`)
      : c.p.services.slice(0, 8).map(i => `<li>${itemLink(c, i, esc(i.title))}</li>`);
    if (cats.length) out += `<nav aria-label="${esc(systemCopy(c.p.lang, 'categories'))}"><ul class="cats">${cats.join('')}</ul></nav>`;
  }
  return out + '</header>';
}

function themeCss(concept, identity) {
  const palette = identity ? visualIdentityTokens(identity) : concept.visualSystem.palette;
  const dark = palette.mode === 'dark';
  const bg = dark ? '#f7f6f2' : '#151719', surface = dark ? '#ffffff' : '#202327';
  const text = readableOn(bg, '#171819', '#f8f7f3');
  const muted = ensureContrast(mix(text, bg, .38), bg, 4.6), border = mix(bg, text, .18);
  return `:root{--uds-alt-bg:${bg};--uds-alt-surface:${surface};--uds-alt-text:${text};--uds-alt-muted:${muted};--uds-alt-border:${border};--uds-alt-focus:${palette.focus || palette.accent}}html[data-uds-theme="alternate"]{color-scheme:${dark ? 'light' : 'dark'};--ds-bg:var(--uds-alt-bg);--ds-surface:var(--uds-alt-surface);--ds-text:var(--uds-alt-text);--ds-text-muted:var(--uds-alt-muted);--ds-border:var(--uds-alt-border);--ds-focus:var(--uds-alt-focus)}.ds-theme-toggle{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:6px 11px;border:1px solid transparent;border-radius:var(--ds-radius-pill);background:transparent;color:var(--ds-text);cursor:pointer;box-shadow:none}.ds-theme-toggle:hover{border-color:transparent;background:transparent}.ds-theme-toggle:focus-visible{outline:2px solid var(--ds-focus);outline-offset:3px}.ds-theme-toggle__label{font-size:.82rem}@media(max-width:760px){.ds-theme-toggle__label{display:none}.ds-theme-toggle{min-width:40px;justify-content:center;padding:6px}}`;
}

// Keep navigation over the first screen instead of reserving a separate bar.
// Navigation variants still control alignment, while their decorative panels
// and backgrounds are suppressed to preserve the transparent overlay treatment.
const HEADER_OVERLAY_CSS = `body.nav-rail{padding-left:0!important}.site-head{position:absolute!important;inset:0 0 auto!important;z-index:50;width:100%;height:auto;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:var(--ds-text);overflow-x:clip}.site-head>.nav{box-sizing:border-box;width:100%;max-width:var(--ds-container);min-width:0;min-height:68px;margin:0 auto!important;padding:12px var(--ds-gutter);border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;color:var(--ds-text);text-shadow:0 1px 12px color-mix(in srgb,var(--ds-bg) 20%,transparent)}.site-head>.nav>*{min-width:0;max-width:100%}.site-head>nav:not(.nav){box-sizing:border-box;width:100%;max-width:var(--ds-container);margin-inline:auto;border-color:transparent!important;background:transparent!important}.site-head>.nav--rail{position:relative!important;inset:auto!important;width:100%!important;max-width:var(--ds-container)!important;min-height:68px!important;flex-direction:row!important;align-items:center!important;overflow:visible!important;border:0!important}.site-head>.nav--rail .nav__links{flex-direction:row!important;overflow-x:auto!important}.site-head .nav__tagline{color:inherit}.site-head + main>.hero,body>main>.hero{padding-top:calc(var(--uds-header-clearance, 240px) + clamp(24px,4vw,48px))!important}@media(min-width:761px) and (max-width:900px){.site-head .nav__contact-actions .ds-contact-action{box-sizing:border-box;max-width:100%;padding-inline:8px;font-size:.78rem}}@media(max-width:760px){.site-head>.nav{min-height:60px;padding:8px var(--ds-gutter)}.site-head + main>.hero,body>main>.hero{padding-top:calc(var(--uds-header-clearance, 240px) + clamp(20px,5vw,36px))!important}}`;

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

// ---------- Hero: 30 композиций ----------
const HERO = {
  'product-first'(c) {
    const it = c.p.services[0];
    // Единый выбор изображения для всех архитектур: hero → галерея → услуга → мотив.
    const media = visual(c);
    const body = it ? `<div class="spotlight__body"><p class="spotlight__label">${esc(c.labels.items)}</p><h2>${esc(it.title)}</h2>${it.text ? `<p>${esc(it.text)}</p>` : ''}${it.price ? `<p class="price">${esc(it.price)}</p>` : ''}${itemLink(c, it, esc(systemCopy(c.p.lang, 'moreDetails')), ' class="ds-button ds-button--secondary"')}</div>` : '';
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
      ? c.p.categories.slice(0, 8).map((t, n) => `<li>${c.order.includes('items') ? `<a href="#items"><span class="n">${pad(n + 1)}</span><span>${esc(t)}</span></a>` : `<span><span class="n">${pad(n + 1)}</span><span>${esc(t)}</span></span>`}</li>`)
      : c.p.services.slice(0, 8).map((i, n) => `<li>${itemLink(c, i, `<span class="n">${pad(n + 1)}</span><span>${esc(i.title)}</span>`)}</li>`);
    const search = c.p.services.length >= 4
      ? `<form class="search" role="search" hidden data-search><label class="vh" for="q">${systemCopy(c.p.lang, 'searchIn')} «${esc(c.labels.items)}»</label><input class="ds-field" type="search" id="q" placeholder="${systemCopy(c.p.lang, 'search')}: ${esc(c.labels.items.toLowerCase())}" autocomplete="off"></form><p class="search__status" role="status" aria-live="polite" data-search-status></p>` : '';
    return `<div class="ds-container hero__wrap"><div class="hero__head">${kicker(c)}${h1(c)}${lede(c)}${search}<div class="actions">${cta(c)}</div></div>${tiles.length ? `<ul class="tiles" role="list">${tiles.join('')}</ul>` : ''}</div>`;
  },
  'split-utility'(c) {
    const checks = c.p.advantages.slice(0, 3).filter(a => a.title).map(a => `<li>${esc(a.title)}</li>`).join('');
    let tool;
    if (c.form) tool = leadForm(c, 'hero');
    else {
      const picks = c.p.services.slice(0, 5).map(i => `<li>${itemLink(c, i, esc(i.title))}</li>`).join('');
      tool = `${picks ? `<ul class="picker">${picks}</ul>` : c.p.contactText ? `<p>${esc(c.p.contactText)}</p>` : ''}${cta(c)}`;
    }
    const title = c.form ? c.cta : c.p.services.length ? `${c.labels.items}: с чего начать` : c.cta;
    return `<div class="ds-container hero__split"><div class="hero__copy">${kicker(c)}${h1(c)}${lede(c)}${checks ? `<ul class="checks">${checks}</ul>` : ''}${c.form ? `<div class="actions">${cta(c, ' ds-button--secondary')}</div>` : ''}</div><div class="tool ds-card"><h2 class="tool__title">${esc(title)}</h2>${tool}</div></div>`;
  },
  storytelling(c) {
    const chapters = c.order.map((id, n) => `<li><a href="#${id}"><span class="n">${pad(n + 2)}</span><span>${esc(c.labels[id])}</span></a></li>`).join('');
    return `<div class="ds-container hero__story"><div><p class="chapter-no">01${c.p.niche ? ' — ' + esc(c.p.niche) : ''}</p>${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div><nav aria-label="${esc(systemCopy(c.p.lang, 'chapters'))}"><ol class="chapters">${chapters}</ol></nav></div><div class="hero__band">${visual(c)}</div>`;
  },
  'modular-grid'(c) {
    const entries = c.p.services.slice(0, 3);
    const cells = entries.map((i, n) => itemLink(c, i, `<span class="n">${pad(n + 1)}</span><strong>${esc(i.title)}</strong>${i.text ? `<span>${esc(i.text)}</span>` : ''}`, ' class="bento__cell bento__entry"')).join('');
    const primaryAction = c.ctaHref ? `<a class="bento__cell bento__cta" data-cta="primary" href="${esc(c.ctaHref)}"><span>${esc(c.cta)}</span><span aria-hidden="true">→</span></a>` : '';
    return `<div class="ds-container"><div class="bento bento--n${entries.length}"><div class="bento__cell bento__head">${kicker(c)}${h1(c)}${lede(c)}</div><div class="bento__cell bento__visual">${visual(c)}</div>${cells}${primaryAction}</div></div>`;
  },
  brutalist(c) {
    const index = c.order.map((id, n) => `<li><a href="#${id}"><span class="n">${pad(n + 1)}</span>${esc(c.labels[id])}</a></li>`).join('');
    return `<div class="hero__frame"><div class="brut__top"><span>${esc(c.brand)}</span>${c.p.niche ? `<span>${esc(c.p.niche)}</span>` : ''}</div><div class="brut__main">${h1(c)}<div class="brut__side">${lede(c)}${cta(c)}</div></div><nav aria-label="${esc(systemCopy(c.p.lang, 'pageSections'))}"><ol class="brut__index">${index}</ol></nav></div>`;
  },
  minimal(c) {
    const proof = c.p.advantages.slice(0, 3).filter(a => a.title).map(a => `<li>${esc(a.title)}</li>`).join('');
    return `<div class="ds-container hero__stack">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div>${proof ? `<ul class="proof">${proof}</ul>` : ''}</div>`;
  },
  'proof-led'(c) {
    const proof = c.p.advantages.slice(0, 4).map((item, i) => `<li><span class="n">${pad(i + 1)}</span><div><h2>${esc(item.title)}</h2>${item.text ? `<p>${esc(item.text)}</p>` : ''}</div></li>`).join('');
    return `<div class="ds-container proof-led__layout"><div class="proof-led__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${proof ? `<ol class="proof-led__list">${proof}</ol>` : `<div class="proof-led__visual">${visual(c)}</div>`}</div>`;
  },
  'service-picker'(c) {
      const options = c.p.services.slice(0, 5).map(item => `<li>${itemLink(c, item, `<span><b>${esc(item.title)}</b>${item.text ? `<small>${esc(item.text)}</small>` : ''}</span>${item.price ? `<strong>${esc(item.price)}</strong>` : '<span aria-hidden="true">→</span>'}`)}</li>`).join('');
    return `<div class="ds-container service-picker__layout"><div>${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${options ? `<nav class="service-picker__panel" aria-label="${esc(c.labels.items)}"><ol>${options}</ol></nav>` : `<div class="service-picker__panel">${visual(c)}</div>`}</div>`;
  },
  'portfolio-mosaic'(c) {
    const photos = c.p.gallery.filter(photo => photo.src).slice(0, 4);
    const mosaic = photos.length ? `<div class="portfolio-mosaic__grid">${photos.map((photo, i) => `<figure class="portfolio-mosaic__photo portfolio-mosaic__photo--${i + 1}"><img src="${esc(photo.src)}" alt="${esc(photo.alt || photo.caption || systemCopy(c.p.lang, 'portfolioWork'))}"${i ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async">${photo.caption ? `<figcaption>${esc(photo.caption)}</figcaption>` : ''}</figure>`).join('')}</div>` : `<figure class="portfolio-mosaic__fallback">${visual(c)}</figure>`;
    return `<div class="ds-container portfolio-mosaic__layout"><div class="portfolio-mosaic__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}${secondary(c, 'gallery')}</div></div>${mosaic}</div>`;
  },
  'process-roadmap'(c) {
    const steps = c.p.process.slice(0, 4).map((step, i) => `<li><span class="n">${pad(i + 1)}</span><div><h2>${esc(step.title)}</h2>${step.text ? `<p>${esc(step.text)}</p>` : ''}</div></li>`).join('');
    return `<div class="ds-container process-roadmap__layout"><div class="process-roadmap__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${steps ? `<ol class="process-roadmap__steps">${steps}</ol>` : `<div class="process-roadmap__visual">${visual(c)}</div>`}</div>`;
  },
  'local-presence'(c) {
    const k = c.p.contacts, lines = [['address', k.address], ['hours', k.hours], ['phone', k.phone], ['email', k.email]].filter(([, value]) => value);
    const details = lines.map(([key, value]) => `<li><span>${esc(systemCopy(c.p.lang, key))}</span><b>${esc(value)}</b></li>`).join('');
    return `<div class="ds-container local-presence__layout"><div>${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${details ? `<address class="local-presence__card"><ul>${details}</ul>${c.p.contactText ? `<p>${esc(c.p.contactText)}</p>` : ''}</address>` : `<div class="local-presence__visual">${visual(c)}</div>`}</div>`;
  },
  'appointment-first'(c) {
    const links = [c.p.contacts.phone && `<a href="tel:${esc(c.p.contacts.phone.replace(/[^+\d]/g, ''))}">${esc(c.p.contacts.phone)}</a>`, c.p.contacts.email && `<a href="mailto:${esc(c.p.contacts.email)}">${esc(c.p.contacts.email)}</a>`].filter(Boolean).join(' · ');
    const action = c.form ? leadForm(c, 'appointment') : `<div class="appointment-first__fallback">${cta(c)}${links ? `<p>${links}</p>` : ''}</div>`;
    return `<div class="ds-container appointment-first__layout"><div>${kicker(c)}${h1(c)}${lede(c)}${c.p.advantages.length ? `<ul class="appointment-first__proof">${c.p.advantages.slice(0, 3).map(item => `<li>${esc(item.title)}</li>`).join('')}</ul>` : ''}</div><div class="appointment-first__form"><h2>${esc(c.cta)}</h2>${action}</div></div>`;
  },
  'story-timeline'(c) {
    const events = c.p.process.slice(0, 4).map((step, i) => `<li><span class="n">${pad(i + 1)}</span><div><h2>${esc(step.title)}</h2>${step.text ? `<p>${esc(step.text)}</p>` : ''}</div></li>`).join('');
    return `<div class="ds-container story-timeline__layout"><div class="story-timeline__intro">${kicker(c)}${h1(c)}${lede(c)}${c.p.aboutText ? `<p>${esc(c.p.aboutText)}</p>` : ''}<div class="actions">${cta(c)}</div></div>${events ? `<ol class="story-timeline__events">${events}</ol>` : `<div class="story-timeline__visual">${visual(c)}</div>`}</div>`;
  },
  'price-comparison'(c) {
    const offers = c.p.services.slice(0, 4).map((item, i) => `<li><span class="n">${pad(i + 1)}</span><div><h2>${esc(item.title)}</h2>${item.text ? `<p>${esc(item.text)}</p>` : ''}</div>${item.price ? `<strong class="price">${esc(item.price)}</strong>` : ''}${itemLink(c, item, '→', ` aria-label="${esc(systemCopy(c.p.lang, 'moreDetails'))}: ${esc(item.title)}"`)}</li>`).join('');
    return `<div class="ds-container price-comparison__layout"><header>${kicker(c)}${h1(c)}${lede(c)}</header>${offers ? `<ol class="price-comparison__offers">${offers}</ol>` : `<div class="price-comparison__visual">${visual(c)}</div>`}<div class="actions">${cta(c)}</div></div>`;
  },
  'brand-manifesto'(c) {
    const statement = c.p.aboutText || c.p.mainOffer || c.p.description;
    return `<div class="ds-container brand-manifesto__layout"><div class="brand-manifesto__copy">${kicker(c)}<p class="brand-manifesto__label">${esc(c.brand)}</p>${h1(c)}${statement ? `<p class="brand-manifesto__statement">${esc(statement)}</p>` : ''}<div class="actions">${cta(c)}</div></div><figure class="brand-manifesto__visual">${visual(c)}</figure></div>`;
  },
  'campaign-landing'(c) {
    const proof = c.p.advantages.slice(0, 3).map(item => `<li>${esc(item.title)}</li>`).join('');
    return `<div class="ds-container campaign-landing__layout"><div class="campaign-landing__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}${secondary(c, 'items')}</div>${proof ? `<ul class="proof">${proof}</ul>` : ''}</div><figure class="campaign-landing__visual">${visual(c)}</figure></div>`;
  },
  'cover-story'(c) {
    const caption = c.p.gallery.find(photo => photo.caption)?.caption || c.p.mainOffer;
    return `<div class="ds-container cover-story__layout"><div class="cover-story__copy">${kicker(c)}<span class="cover-story__issue">${esc(c.brand)}</span>${h1(c)}${lede(c)}${caption ? `<p class="cover-story__caption">${esc(caption)}</p>` : ''}<div class="actions">${cta(c)}</div></div><figure class="cover-story__visual">${visual(c)}</figure></div>`;
  },
  'split-screen'(c) {
    return `<div class="split-screen__layout"><div class="split-screen__copy">${kicker(c)}<div class="ds-container">${h1(c)}${lede(c)}<div class="actions">${cta(c)}${secondary(c, c.order[0])}</div></div></div><figure class="split-screen__visual">${visual(c)}</figure></div>`;
  },
  'faq-first'(c) {
    const faqs = c.p.faqs.slice(0, 4).map(item => `<details><summary>${esc(item.title)}</summary><p>${esc(item.text)}</p></details>`).join('');
    return `<div class="ds-container faq-first__layout"><div class="faq-first__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${faqs ? `<div class="faq-first__list" aria-label="${esc(c.labels.faq)}">${faqs}</div>` : `<div class="faq-first__visual">${visual(c)}</div>`}</div>`;
  },
  'feature-grid'(c) {
    const features = c.p.advantages.slice(0, 4).map((item, i) => `<article class="feature-grid__item"><span class="n">${pad(i + 1)}</span><h2>${esc(item.title)}</h2>${item.text ? `<p>${esc(item.text)}</p>` : ''}</article>`).join('');
    return `<div class="ds-container feature-grid__layout"><header>${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></header>${features ? `<div class="feature-grid__items">${features}</div>` : `<div class="feature-grid__visual">${visual(c)}</div>`}</div>`;
  },
  'service-directory'(c) {
    const services = c.p.services.slice(0, 6).map((item, i) => `<li>${itemLink(c, item, `<span class="n">${pad(i + 1)}</span><span class="service-directory__name">${esc(item.title)}</span><span class="service-directory__arrow" aria-hidden="true">↗</span>`)}</li>`).join('');
    return `<div class="ds-container service-directory__layout"><header>${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></header>${services ? `<ol class="service-directory__list">${services}</ol>` : `<div class="service-directory__visual">${visual(c)}</div>`}</div>`;
  },
  'pricing-cards'(c) {
    const offers = c.p.services.slice(0, 3).map(item => `<article class="pricing-cards__item"><span class="n">${pad(c.p.services.indexOf(item) + 1)}</span><h2>${esc(item.title)}</h2>${item.text ? `<p>${esc(item.text)}</p>` : ''}${item.price ? `<strong class="price">${esc(item.price)}</strong>` : ''}${itemLink(c, item, `${esc(systemCopy(c.p.lang, 'moreDetails'))} <span aria-hidden="true">→</span>`)}</article>`).join('');
    return `<div class="ds-container pricing-cards__layout"><header>${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></header>${offers ? `<div class="pricing-cards__items">${offers}</div>` : `<div class="pricing-cards__visual">${visual(c)}</div>`}</div>`;
  },
  'portfolio-feature'(c) {
    const photos = c.p.gallery.filter(photo => photo.src).slice(0, 5);
    const lead = photos[0];
    const media = lead ? `<figure class="portfolio-feature__lead"><img src="${esc(lead.src)}" alt="${esc(lead.alt || lead.caption || systemCopy(c.p.lang, 'featuredWork'))}" fetchpriority="high" decoding="async">${lead.caption ? `<figcaption>${esc(lead.caption)}</figcaption>` : ''}</figure>` : `<figure class="portfolio-feature__lead">${visual(c)}</figure>`;
    const strip = photos.slice(1).map(photo => `<img src="${esc(photo.src)}" alt="${esc(photo.alt || photo.caption || systemCopy(c.p.lang, 'portfolioWork'))}" loading="lazy" decoding="async">`).join('');
    return `<div class="ds-container portfolio-feature__layout"><div class="portfolio-feature__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}${secondary(c, 'gallery')}</div></div><div class="portfolio-feature__media">${media}${strip ? `<div class="portfolio-feature__strip">${strip}</div>` : ''}</div></div>`;
  },
  'contact-hub'(c) {
    const k = c.p.contacts;
    const channels = [k.phone && `<a href="tel:${esc(k.phone.replace(/[^+\d]/g, ''))}"><span>${esc(systemCopy(c.p.lang, 'phone'))}</span><b>${esc(k.phone)}</b></a>`, k.email && `<a href="mailto:${esc(k.email)}"><span>${esc(systemCopy(c.p.lang, 'email'))}</span><b>${esc(k.email)}</b></a>`, k.address && `<div><span>${esc(systemCopy(c.p.lang, 'address'))}</span><b>${esc(k.address)}</b></div>`, k.hours && `<div><span>${esc(systemCopy(c.p.lang, 'hours'))}</span><b>${esc(k.hours)}</b></div>`].filter(Boolean).join('');
    return `<div class="ds-container contact-hub__layout"><div class="contact-hub__copy">${kicker(c)}${h1(c)}${lede(c)}<div class="actions">${cta(c)}</div></div>${channels ? `<address class="contact-hub__channels">${channels}</address>` : `<div class="contact-hub__visual">${visual(c)}</div>`}</div>`;
  },
  'quick-form'(c) {
    return `<div class="ds-container quick-form__layout"><div>${kicker(c)}${h1(c)}${lede(c)}${c.p.advantages.length ? `<ul class="quick-form__proof">${c.p.advantages.slice(0, 3).map(item => `<li>${esc(item.title)}</li>`).join('')}</ul>` : ''}</div><div class="quick-form__panel">${c.form ? leadForm(c, 'quick') : cta(c)}</div></div>`;
  },
  'type-statement'(c) {
    const statement = c.p.mainOffer || c.p.brandCharacter || c.p.description;
    return `<div class="ds-container type-statement__layout"><p class="type-statement__index">${esc(c.brand)} <span>— ${esc(c.p.niche || '01')}</span></p>${kicker(c)}${h1(c)}${statement ? `<p class="type-statement__note">${esc(statement)}</p>` : ''}<div class="actions">${cta(c)}</div><div class="type-statement__shape" aria-hidden="true">${motifSvg(c.vs, 1)}</div></div>`;
  },
};

// ---------- Секции ----------
const wrap = (c, id, inner, intro = '') => `<section id="${id}" class="${sectionClass(c, id)}" data-motion-section aria-labelledby="${id}-h"><div class="ds-container"><header class="sec__head" data-reveal><h2 id="${id}-h">${esc(c.titles[id])}</h2>${intro ? `<p class="sec__intro">${esc(intro)}</p>` : ''}</header>${inner}</div></section>`;

const SECTION = {
  about: c => `<section id="about" class="${sectionClass(c, 'about')}" data-motion-section aria-labelledby="about-h"><div class="ds-container"><header class="sec__head" data-reveal><h2 id="about-h">${esc(c.titles.about)}</h2></header><p class="about__text" data-reveal>${esc(c.p.aboutText)}</p></div></section>`,
  items(c) {
    const v = c.vs.variants.items;
    const mech = c.vs.variants.itemsMechanic || 'none';
    const renderItems = (entries, offset) => entries.map((i, localIndex) => {
      const n = offset + localIndex;
      const mobile = c.p.passthrough?.imageArtDirection?.mobileSources?.services?.[n];
      const img = mobile ? `<picture><source media="(max-width:600px)" srcset="${esc(mobile)}"><img ${artStyle(c.p, "services", n)} src="${esc(i.image)}" alt="${esc(i.alt || i.title)}" loading="lazy" decoding="async"></picture>` : `<img ${artStyle(c.p, "services", n)} src="${esc(i.image)}" alt="${esc(i.alt || i.title)}" loading="lazy" decoding="async">`;
      const media = i.image ? `<div class="item__media">${img}</div>` : '';
      const shop = c.vs.commerce?.tools || c.vs.commerce?.cart;
      const parts = { media, title: `${i.badge ? `<span class="item__badge">${esc(i.badge)}</span>` : ''}<h3>${esc(i.title)}</h3>`, text: i.text ? `<p>${esc(i.text)}</p>` : '', price: i.price ? `<p class="price">${esc(i.price)}</p>` : '', action: c.vs.commerce?.cart ? addButton(i, n, c.p.lang) : '', moreLabel: esc(systemCopy(c.p.lang, 'moreDetails')), flipHint: esc(systemCopy(c.p.lang, 'flipHint')) };
      const flip = mech === 'flip' && media && parts.text;
      // Переворот открывается и с клавиатуры: карточка получает фокус, а :focus-within поворачивает её.
      const attrs = `${flip ? ' tabindex="0"' : ''}${mech === 'stack' ? ` style="--stack-i:${n}"` : ''}`;
      const editScope = canvasEditScope('item', i.id);
      return `<li class="item${flip ? ' item--flip' : ''}${i.image ? ' item--photo' : ''}" id="${itemAnchor(i)}" data-uds-item-id="${esc(i.id)}" data-uds-item-index="${n}" data-uds-edit-scope="${editScope}"${shop ? itemAttrs(i) : ''}${attrs} data-reveal>${mechanicBody(mech, parts)}</li>`;
    }).join('');
    const listClass = `items items--${v}${mech !== 'none' ? ` items--mech-${mech}` : ''}`;
    const pageSize = 12;
    const initial = c.p.services.slice(0, pageSize);
    const remaining = c.p.services.slice(pageSize);
    const list = `<ul class="${listClass}" role="list">${renderItems(initial, 0)}</ul>${remaining.length ? `<details class="items__more"><summary>${systemCopy(c.p.lang, 'more')} (${remaining.length})</summary><ul class="${listClass}" role="list">${renderItems(remaining, pageSize)}</ul></details>` : ''}`;
    const body = mech === 'rail'
      ? `<div class="rail" role="region" aria-label="${esc(c.labels.items)}: ${esc(systemCopy(c.p.lang, 'scrollHint'))}" tabindex="0">${list}</div><p class="rail__hint" aria-hidden="true">${esc(systemCopy(c.p.lang, 'scrollHint'))}</p>`
      : list;
    return wrap(c, 'items', `${c.vs.commerce?.tools ? catalogControls(c.p) : ''}${body}`, c.p.servicesIntro);
  },
  advantages(c) {
    const li = c.p.advantages.map(a => `<li data-uds-item-id="${esc(a.id)}" data-uds-edit-scope="${canvasEditScope('advantage', a.id)}" data-reveal><h3>${esc(a.title)}</h3>${a.text ? `<p>${esc(a.text)}</p>` : ''}</li>`).join('');
    return wrap(c, 'advantages', `<ul class="adv adv--${c.vs.variants.advantages}" role="list">${li}</ul>`, c.p.advantagesIntro);
  },
  process(c) {
    const li = c.p.process.map(a => `<li data-uds-item-id="${esc(a.id)}" data-uds-edit-scope="${canvasEditScope('process', a.id)}" data-reveal><h3>${esc(a.title)}</h3>${a.text ? `<p>${esc(a.text)}</p>` : ''}</li>`).join('');
    return wrap(c, 'process', `<ol class="proc proc--${c.vs.variants.process}" role="list">${li}</ol>`);
  },
  pricing(c) {
    const entries = c.p.pricing.filter(item => item.price).map((item, index) => `<article class="uds-pricing-card" data-uds-item-id="${esc(item.id)}" data-uds-edit-scope="${canvasEditScope('pricing', item.id)}" data-reveal><span class="uds-pricing-card__index">${String(index + 1).padStart(2, '0')}</span><h3>${esc(item.title)}</h3>${item.text ? `<p>${esc(item.text)}</p>` : ''}<strong class="uds-pricing-card__price">${esc(item.price)}</strong>${c.ctaHref ? `<a class="ds-button ds-button--secondary" href="${esc(c.ctaHref)}">${c.p.lang.startsWith('en') ? 'Ask about this option' : 'Уточнить условия'}</a>` : ''}</article>`).join('');
    return wrap(c, 'pricing', `<div class="uds-pricing">${entries}</div>`);
  },
  cases(c) {
    const entries = c.p.cases.map((item, index) => { const conceptImage = /^AI-концепт\s*[·—-]/i.test(item.alt); const conceptNote = c.p.lang.startsWith('en') ? 'AI concept illustration — not a photo of completed work' : 'AI-концепт, иллюстрация — не фото выполненной работы'; return `<article class="uds-case" data-uds-item-id="${esc(item.id)}" data-uds-edit-scope="${canvasEditScope('case', item.id)}" data-reveal>${item.image ? `<img ${artStyle(c.p, 'cases', index)} src="${esc(item.image)}" alt="${esc(item.alt || item.title)}" loading="lazy" decoding="async">` : ''}<div><h3>${esc(item.title)}</h3>${conceptImage ? `<small class="uds-case__concept-note">${conceptNote}</small>` : ''}${item.text ? `<p>${esc(item.text)}</p>` : ''}</div></article>`; }).join('');
    return wrap(c, 'cases', `<div class="uds-cases">${entries}</div>`);
  },
  gallery(c) {
    const li = c.p.gallery.map((g, n) => { const mobile = c.p.passthrough?.imageArtDirection?.mobileSources?.gallery?.[n]; const img = mobile ? `<picture><source media="(max-width:600px)" srcset="${esc(mobile)}"><img ${artStyle(c.p, "gallery", n)} src="${esc(g.src)}" alt="${esc(g.alt || g.caption)}" loading="lazy" decoding="async"></picture>` : `<img ${artStyle(c.p, "gallery", n)} src="${esc(g.src)}" alt="${esc(g.alt || g.caption)}" loading="lazy" decoding="async">`; return `<li data-uds-item-id="${esc(g.id)}" data-uds-edit-scope="${canvasEditScope('gallery', g.id)}" data-reveal><figure>${img}${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''} </figure></li>`; }).join('');
    const composition = c.vs.photoComposition || 'grid';
    const countClass = composition === 'fan' ? ` gallery--fan--count-${c.p.gallery.length}` : '';
    if (composition === 'filmstrip') {
      const prev = c.p.lang.startsWith('en') ? 'Previous photos' : 'Предыдущие фотографии';
      const next = c.p.lang.startsWith('en') ? 'Next photos' : 'Следующие фотографии';
      return wrap(c, 'gallery', `<div class="gallery-carousel"><ul class="gallery gallery--filmstrip${countClass}" role="list" tabindex="0" aria-label="${esc(c.p.lang.startsWith('en') ? 'Photo gallery. Swipe or use arrows to see more.' : 'Галерея фотографий. Листайте или используйте стрелки, чтобы увидеть остальные.')}" data-gallery-track>${li}</ul><div class="gallery-carousel__controls" data-gallery-controls><button class="gallery-carousel__button" type="button" data-gallery-prev aria-label="${esc(prev)}" disabled>←</button><button class="gallery-carousel__button" type="button" data-gallery-next aria-label="${esc(next)}">→</button></div></div>`);
    }
    return wrap(c, 'gallery', `<ul class="gallery gallery--${esc(composition)}${countClass}" role="list">${li}</ul>`);
  },
  quiz(c) {
    const services = c.p.services.filter(item => item.title);
    const serviceChoices = services.map((item, index) => `<label class="uds-quiz__choice"><input type="radio" name="uds-quiz-service" value="${esc(item.title)}" aria-label="${esc(item.title)}"${index === 0 ? ' required' : ''}><span>${esc(item.title)}</span></label>`).join('');
    const priorities = c.p.lang.startsWith('en')
      ? [['cost', 'Understand the cost'], ['speed', 'Find the fastest option'], ['custom', 'Discuss a tailored solution']]
      : [['cost', 'Сначала узнать стоимость'], ['speed', 'Найти самый быстрый вариант'], ['custom', 'Обсудить индивидуальное решение']];
    const priorityChoices = priorities.map(([value, label], index) => `<label class="uds-quiz__choice"><input type="radio" name="uds-quiz-priority" value="${esc(value)}" aria-label="${esc(label)}"${index === 0 ? ' required' : ''}><span>${esc(label)}</span></label>`).join('');
    const title = c.p.lang.startsWith('en') ? 'What are you looking for?' : 'Что вы хотите подобрать?';
    const priority = c.p.lang.startsWith('en') ? 'What matters most?' : 'Что для вас важнее?';
    const submit = c.p.lang.startsWith('en') ? 'Show my selection' : 'Показать мой подбор';
    return wrap(c, 'quiz', `<form class="uds-quiz" data-uds-quiz><fieldset><legend>${title}</legend><div class="uds-quiz__choices">${serviceChoices}</div></fieldset><fieldset><legend>${priority}</legend><div class="uds-quiz__choices uds-quiz__choices--priority">${priorityChoices}</div></fieldset><button class="ds-button" type="submit">${submit}</button><p class="uds-quiz__result" data-uds-quiz-result role="status" aria-live="polite" hidden></p></form>`);
  },
  faq(c) {
    const d = c.p.faqs.map(f => `<details data-uds-item-id="${esc(f.id)}" data-uds-edit-scope="${canvasEditScope('faq', f.id)}"><summary>${esc(f.title)}</summary><p>${esc(f.text)}</p></details>`).join('');
    const composition = c.vs.sectionCompositions?.faq || 'list';
    return wrap(c, 'faq', `<div class="faq faq--${esc(composition)}">${d}</div>`);
  },
  testimonials(c) {
    const rows = c.p.testimonials.map(item => `<figure class="uds-testimonial" data-uds-item-id="${esc(item.id)}" data-uds-edit-scope="${canvasEditScope('testimonial', item.id)}"><blockquote>${esc(item.text || item.title)}</blockquote>${item.text && item.title ? `<figcaption>${esc(item.title)}</figcaption>` : ''}</figure>`).join('');
    return wrap(c, 'testimonials', `<div class="uds-testimonials">${rows}</div>`);
  },
  team(c) {
    const rows = c.p.team.map(item => `<article class="uds-team-card" data-uds-item-id="${esc(item.id)}" data-uds-edit-scope="${canvasEditScope('team', item.id)}">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.alt || item.title)}" loading="lazy" decoding="async">` : ''}<h3>${esc(item.title)}</h3>${item.text ? `<p>${esc(item.text)}</p>` : ''}</article>`).join('');
    return wrap(c, 'team', `<div class="uds-team">${rows}</div>`);
  },
  stats(c) {
    const rows = c.p.stats.map(item => `<div class="uds-stat" data-uds-item-id="${esc(item.id)}" data-uds-edit-scope="${canvasEditScope('stat', item.id)}"><strong>${esc(item.title)}</strong>${item.text ? `<span>${esc(item.text)}</span>` : ''}</div>`).join('');
    return wrap(c, 'stats', `<div class="uds-stats">${rows}</div>`);
  },
  contact(c) {
    const k = c.p.contacts, rows = [];
    if (k.phone) rows.push(`<li><span>${systemCopy(c.p.lang, 'phone')}</span><a href="tel:${esc(k.phone.replace(/[^\d+]/g, ''))}">${esc(k.phone)}</a></li>`);
    if (k.email) rows.push(`<li><span>${systemCopy(c.p.lang, 'email')}</span><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></li>`);
    if (k.address) rows.push(`<li><span>${systemCopy(c.p.lang, 'address')}</span>${esc(k.address)}</li>`);
    if (k.hours) rows.push(`<li><span>${systemCopy(c.p.lang, 'hours')}</span>${esc(k.hours)}</li>`);
    const form = leadForm(c, 'contact');
    const ext = c.p.ctaUrl && !c.p.ctaUrl.startsWith('#') ? `<div class="actions">${cta(c)}</div>` : '';
    const composition = c.vs.sectionCompositions?.contact || 'split';
    return `<section id="contact" class="${sectionClass(c, 'contact')}" data-motion-section aria-labelledby="contact-h"><div class="ds-container contact${form ? ' contact--two' : ''} contact--layout-${esc(composition)}"><div data-reveal><h2 id="contact-h">${esc(c.titles.contact)}</h2>${c.p.contactText ? `<p class="lede">${esc(c.p.contactText)}</p>` : ''}${rows.length ? `<ul class="contact__list">${rows.join('')}</ul>` : ''}${contactActions(c)}${ext}</div>${form ? `<div data-reveal>${form}</div>` : ''}</div></section>`;
  },
};

// ---------- Скрипт страницы: только нужные фрагменты ----------
function script(c, scene) {
  const parts = [textFitScript()];
  // Keep the header visually over the hero while reserving enough room for the
  // actual navigation variant (some wrap to multiple rows at tablet widths).
  parts.push(`(function(){var header=document.querySelector('.site-head'),hero=document.querySelector('main>.hero,body>main>.hero');if(!header||!hero)return;var update=function(){var height=Math.ceil(header.getBoundingClientRect().height);if(height>0)hero.style.setProperty('--uds-header-clearance',height+'px')};update();if('ResizeObserver'in window)new ResizeObserver(update).observe(header);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(update);addEventListener('load',update,{once:true})})()`);
  const themeKey = JSON.stringify(`uds:theme:${c.p.id || 'site'}`);
  parts.push(`(function(){var root=document.documentElement,key=${themeKey},button=document.querySelector('[data-theme-toggle]'),saved='';try{saved=localStorage.getItem(key)||''}catch(e){}if(saved==='alternate')root.dataset.udsTheme='alternate';if(button){button.setAttribute('aria-pressed',String(root.dataset.udsTheme==='alternate'));button.addEventListener('click',function(){var alternate=root.dataset.udsTheme!=='alternate';if(alternate)root.dataset.udsTheme='alternate';else delete root.dataset.udsTheme;button.setAttribute('aria-pressed',String(alternate));try{localStorage.setItem(key,alternate?'alternate':'default')}catch(e){}})}})()`);
  const reduce = `matchMedia('(prefers-reduced-motion: reduce)').matches`;
  if (c.order.includes('gallery') && c.vs.photoComposition === 'filmstrip') parts.push(`document.querySelectorAll('.gallery-carousel').forEach(function(carousel){var track=carousel.querySelector('[data-gallery-track]'),prev=carousel.querySelector('[data-gallery-prev]'),next=carousel.querySelector('[data-gallery-next]'),controls=carousel.querySelector('[data-gallery-controls]');if(!track||!prev||!next||!controls)return;var update=function(){var max=track.scrollWidth-track.clientWidth;controls.hidden=max<2;prev.disabled=track.scrollLeft<2;next.disabled=track.scrollLeft>=max-2};var move=function(direction){track.scrollBy({left:direction*Math.max(220,track.clientWidth*.82),behavior:${reduce}?'auto':'smooth'})};prev.addEventListener('click',function(){move(-1)});next.addEventListener('click',function(){move(1)});track.addEventListener('scroll',update,{passive:true});track.addEventListener('keydown',function(event){if(event.key==='ArrowLeft'){event.preventDefault();move(-1)}else if(event.key==='ArrowRight'){event.preventDefault();move(1)}});if('ResizeObserver'in window)new ResizeObserver(update).observe(track);addEventListener('load',update,{once:true});update()})`);
  if (c.form) {
    const copy = ['sending', 'sent', 'failed'].map(key => JSON.stringify(systemCopy(c.p.lang, key))).join(',');
    parts.push(`document.querySelectorAll('form[data-form-delivery="endpoint-configured"]').forEach(function(f){var u;try{u=new URL(f.action,location.href)}catch(e){return}if(u.origin!==location.origin)return;var status=f.querySelector('[data-form-status]'),button=f.querySelector('[type="submit"]');if(!status||!button)return;var msg=[${copy}];f.addEventListener('submit',function(e){e.preventDefault();status.hidden=false;status.textContent=msg[0];status.dataset.state='sending';button.disabled=true;fetch(f.action,{method:f.method||'POST',body:new FormData(f),credentials:'same-origin',headers:{Accept:'application/json'}}).then(function(r){if(!r.ok||r.redirected)throw new Error('delivery');f.reset();status.textContent=msg[1];status.dataset.state='success'}).catch(function(){status.textContent=msg[2];status.dataset.state='error'}).finally(function(){button.disabled=false})})})`);
  }
  if (c.order.includes('quiz')) {
    const messages = c.p.lang.startsWith('en')
      ? ['Your selection: ', '. We will use this when you contact us.']
      : ['Ваш подбор: ', '. Он будет добавлен к заявке.'];
    parts.push(`document.querySelectorAll('[data-uds-quiz]').forEach(function(q){q.addEventListener('submit',function(e){e.preventDefault();if(!q.reportValidity())return;var service=q.querySelector('[name="uds-quiz-service"]:checked'),priority=q.querySelector('[name="uds-quiz-priority"]:checked');if(!service||!priority)return;var labels={cost:${JSON.stringify(c.p.lang.startsWith('en') ? 'understand the cost' : 'узнать стоимость')},speed:${JSON.stringify(c.p.lang.startsWith('en') ? 'find the fastest option' : 'найти быстрый вариант')},custom:${JSON.stringify(c.p.lang.startsWith('en') ? 'discuss a tailored solution' : 'обсудить индивидуальное решение')}};var summary=service.value+'; '+(labels[priority.value]||priority.value),out=q.querySelector('[data-uds-quiz-result]');out.textContent=${JSON.stringify(messages[0])}+summary+${JSON.stringify(messages[1])};out.hidden=false;document.querySelectorAll('[data-quiz-summary]').forEach(function(input){input.value=summary});document.querySelectorAll('[name="topic"]').forEach(function(select){if(Array.from(select.options).some(function(option){return option.value===service.value}))select.value=service.value});var contact=document.getElementById('contact');if(contact)contact.scrollIntoView({behavior:${reduce}?'auto':'smooth',block:'start'})})})`);
  }
  if (c.p.services.length > 12) parts.push(`document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var target;try{target=document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))}catch(_){return}var more=target&&target.closest('details.items__more');if(more&&!more.open){e.preventDefault();more.open=true;history.pushState(null,'',a.getAttribute('href'));requestAnimationFrame(function(){target.scrollIntoView({behavior:'smooth',block:'center'})})}})`);
  if (siteRevealActive(c.vs)) parts.push(`if('IntersectionObserver'in window&&!${reduce}){var targets=document.querySelectorAll('[data-motion-section]');targets.forEach(function(section,index){section.dataset.motionIndex=String(index);var box=section.querySelector('.ds-container');if(box)Array.from(box.children).forEach(function(child){if(!child.matches('.sec__head[data-reveal]')&&!child.hasAttribute('data-reveal')&&!child.matches('[data-uds-edit-key],[class*="uds-added-element"]')&&!child.querySelector('[data-reveal],[data-uds-edit-key],[class*="uds-added-element"]'))child.setAttribute('data-reveal','')})});var reveals=Array.from(document.querySelectorAll('[data-motion-section] [data-reveal],.hero [data-reveal]')).filter(function(el){return !el.closest('[data-uds-edit-key],[class*="uds-added-element"]')});reveals.forEach(function(el){var siblings=el.parentElement?Array.from(el.parentElement.children):[],index=Math.max(0,siblings.indexOf(el));el.style.setProperty('--uds-reveal-delay',Math.min(index*85,340)+'ms')});document.documentElement.classList.add('js-reveal');var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle('is-in',e.isIntersecting)})},{rootMargin:'0px 0px -10% 0px'});reveals.forEach(function(el){io.observe(el)});if(${siteMotionActive(c.vs)}){var active=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){targets.forEach(function(s){s.classList.toggle('is-motion-active',s===e.target)})}})},{rootMargin:'-42% 0px -42% 0px',threshold:0});targets.forEach(function(s){active.observe(s)})}}`);
  if (siteMotionActive(c.vs)) {
    if (!c.vs.motionPlan?.mechanics.includes('scroll-progress')) parts.push(`if(!${reduce}){var bar=document.createElement('div');bar.className='m-progress uds-reading-progress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);var queued=false,update=function(){if(queued)return;queued=true;requestAnimationFrame(function(){var max=document.documentElement.scrollHeight-innerHeight,progress=max>0?Math.max(0,Math.min(1,scrollY/max)):0;bar.style.setProperty('--m-p',String(progress));queued=false})};addEventListener('scroll',update,{passive:true});addEventListener('resize',update,{passive:true});update()}`);
    const photoTargets = ['.hero__bg img', ...(HERO_PHOTO_BG.has(c.vs.archetype) ? ['.hero__photo-bg img'] : []), '.item__media img', '.gallery img'].join(',');
    parts.push(`if(!${reduce}&&'IntersectionObserver'in window){var photos=document.querySelectorAll(${JSON.stringify(photoTargets)}),visible=new Set(),photoIO=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){visible.add(e.target);e.target.classList.add('uds-photo-parallax')}else{visible.delete(e.target);e.target.classList.remove('uds-photo-parallax');e.target.style.removeProperty('--uds-photo-shift')}})},{rootMargin:'80px 0px'});photos.forEach(function(img){photoIO.observe(img)});var photoQueued=false,movePhotos=function(){if(photoQueued)return;photoQueued=true;requestAnimationFrame(function(){visible.forEach(function(img){var r=img.getBoundingClientRect(),shift=Math.max(-7,Math.min(7,(innerHeight/2-(r.top+r.height/2))*.012));img.style.setProperty('--uds-photo-shift',shift.toFixed(1)+'px')});photoQueued=false})};addEventListener('scroll',movePhotos,{passive:true});addEventListener('resize',movePhotos,{passive:true});movePhotos()}`);
  }
  if (c.vs.motionPlan?.mechanics.includes('parallax')) parts.push(`var px=document.querySelector('[data-parallax]');if(px&&!${reduce}){var tick=false;addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){px.style.transform='translate3d(0,'+Math.min(scrollY*.08,40)+'px,0)';tick=false})},{passive:true})}`);
  if (c.vs.archetype === 'catalog' && c.p.services.length >= 4) parts.push(`var sf=document.querySelector('[data-search]');if(sf){sf.hidden=false;var st=document.querySelector('[data-search-status]');sf.addEventListener('submit',function(e){e.preventDefault();document.getElementById('items').scrollIntoView()});sf.querySelector('input').addEventListener('input',function(e){var q=e.target.value.trim().toLowerCase(),n=0;var items=document.querySelectorAll('#items .item'),tools=document.querySelector('[data-catalog-tools]');if(tools){items.forEach(function(li){if(!q||li.textContent.toLowerCase().indexOf(q)>-1)n++});tools.dispatchEvent(new CustomEvent('uds:catalog-search'));}else{items.forEach(function(li){var ok=!q||li.textContent.toLowerCase().indexOf(q)>-1;li.hidden=!ok;if(ok)n++})}if(!tools)st.textContent=q?'Найдено: '+n:''})}`);
  if ((c.vs.commerce?.tools || c.vs.commerce?.cart) && c.order.includes('items')) parts.push(commerceScript(c.p));
  // «Раскрытие строк» само делит заголовок на строки — пословная кинетика заголовка при нём не нужна.
  const plan = c.vs.effects?.hero === 'line-split' && c.vs.motionPlan ? { ...c.vs.motionPlan, mechanics: c.vs.motionPlan.mechanics.filter(m => m !== 'kinetic-type') } : c.vs.motionPlan;
  const motion = motionScript(plan);
  if (motion) parts.push(motion);
  const fxScript = effectsScript(c.vs.effects);
  if (fxScript) parts.push(fxScript);
  const btnScript = buttonAnimationScript(compatibleButtonAnimation(c.vs));
  if (btnScript) parts.push(btnScript);
  const cinematic = sceneScript(scene);
  if (cinematic) parts.push(cinematic);
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

// Палитры Visual Identity заданы вручную. Перед выводом доводим пары до WCAG AA теми же функциями,
// что и основную палитру движка: вторичный текст и акцентный текст — не ниже 4.6:1 к фону и поверхности,
// текст на акцентной кнопке — не ниже 4.5:1. Цвет самой кнопки (акцент) не меняется.
export function visualIdentityTokens(identity) {
  const p = identity.palette;
  let muted = ensureContrast(p.muted, p.background, 4.6);
  muted = ensureContrast(muted, p.surface, 4.6);
  let accentInk = ensureContrast(p.accent, p.background, 4.6);
  accentInk = ensureContrast(accentInk, p.surface, 4.6);
  let accentText = readableOn(p.accent, '#171615', '#ffffff');
  if (contrast(accentText, p.accent) < 4.5) accentText = readableOn(p.accent, '#000000', '#ffffff');
  return { ...p, muted, accentInk, accentText };
}

/** Начертания Google Fonts для гарнитур Visual Identity: у части семейств есть только 400,
 *  а запрос несуществующего начертания отклоняет весь URL шрифтов. */
const VI_SINGLE_WEIGHT = new Set(['Archivo Black', 'DM Serif Display']);
export function visualIdentityFonts(identity) {
  const t = identity.typography;
  return [...new Set([t.display, t.body])].map(family => ({ family, weights: VI_SINGLE_WEIGHT.has(family) ? '400' : '400;500;600;700' }));
}

function visualIdentityCss(identity) {
  if (!identity) return '';
  const p = visualIdentityTokens(identity), t = identity.typography, g = identity.geometry, space = identity.spacing;
  return `:root{color-scheme:${p.mode};--ds-bg:${p.background};--ds-surface:${p.surface};--ds-text:${p.text};--ds-text-muted:${p.muted};--ds-accent:${p.accent};--u-tint:${p.accentSoft};--u-accent-ink:${p.accentInk};--ds-accent-contrast:${p.accentText};--ds-radius-sm:${g.radius.small};--ds-radius-md:${g.radius.medium};--ds-radius-lg:${g.radius.large};--ds-radius-pill:${g.radius.pill};--ds-section-space:${space.section};--ds-font-display:"${t.display}",sans-serif;--ds-font-body:"${t.body}",sans-serif}`;
}

/** CSS раскладки секций. Новые раскладки получают своё оформление и композицию фотогалереи
 *  от базовой раскладки того же семейства (те же правила, переименованные под новую раскладку). */
function sectionLayoutCss(id) {
  if (SECTION_LAYOUT_CSS[id]) return SECTION_LAYOUT_CSS[id];
  const family = LAYOUT_ORDER_FAMILY[id];
  if (!EXTRA_LAYOUT_CSS[id] || !family) return SECTION_LAYOUT_CSS.editorial;
  const re = new RegExp(`(@media\\([^{]*\\)\\{)?[^{}]*\\.sec--gallery\\.section-layout--${family}[^{]*\\{[^}]*\\}(\\})?`, 'g');
  const gallery = (SECTION_LAYOUT_CSS[family].match(re) || []).join('').replaceAll(`section-layout--${family}`, `section-layout--${id}`);
  return EXTRA_LAYOUT_CSS[id] + gallery;
}

// Стили кнопок и анимации, которые используют одни и те же псевдоэлементы, не совмещаются:
// «выезжающая заливка» занимает ::before (как блик), «стрелка» — ::after (как пульс, толчок и обводка).
const BUTTON_PSEUDO = { slide: ['shine'], arrow: ['pulse', 'nudge', 'border-draw'], block: ['border-draw'], underline: ['underline-grow', 'border-draw'] };
function compatibleButtonAnimation(vs) {
  const a = vs.typography2?.buttonAnimation;
  return a && !(BUTTON_PSEUDO[vs.button?.id] || []).includes(a) ? a : '';
}

/** Появление при прокрутке: по плану движения или по ручному выбору эффекта владельцем. */
// Универсальное появление действует для всех ниш; отключается только явным статичным режимом.
const siteMotionActive = vs => vs.motionPlan?.mode !== 'static';
const siteRevealActive = vs => siteMotionActive(vs) || Boolean(vs.variety?.revealForced);

const siteMotionCss = (vs, hasHeroBackground) => siteMotionActive(vs) ? `@media(prefers-reduced-motion:no-preference){.ds-section[data-motion-section],.foot[data-motion-section]{transition:box-shadow 900ms cubic-bezier(.2,.7,.2,1)}.ds-section.is-motion-active,.hero.is-motion-active,.foot.is-motion-active{box-shadow:inset 0 1px 0 color-mix(in srgb,var(--ds-accent) 14%,transparent),inset 0 40px 100px -90px color-mix(in srgb,var(--ds-accent) 16%,transparent)}.uds-reading-progress{position:fixed;inset:0 0 auto;height:2px;z-index:100;transform-origin:left center;transform:scaleX(var(--m-p,0));background:linear-gradient(90deg,color-mix(in srgb,var(--ds-accent) 72%,transparent),var(--ds-accent));pointer-events:none;opacity:.78}.hero__bg img,${hasHeroBackground ? '.hero__photo-bg img,' : ''}.item__media img,.gallery img{translate:0 var(--uds-photo-shift,0px);scale:1.025;transition:translate 700ms cubic-bezier(.2,.7,.2,1),scale 900ms cubic-bezier(.2,.7,.2,1)}.uds-photo-parallax{will-change:translate}.item,.ds-card,.uds-pricing-card,.uds-case,.uds-team-card,.uds-testimonial{transition:translate 450ms cubic-bezier(.2,.7,.2,1),box-shadow 450ms cubic-bezier(.2,.7,.2,1)}}@media(prefers-reduced-motion:no-preference) and (hover:hover) and (pointer:fine){.item:hover,.ds-card:hover,.uds-pricing-card:hover,.uds-case:hover,.uds-team-card:hover,.uds-testimonial:hover{translate:0 -3px;box-shadow:0 18px 46px color-mix(in srgb,var(--ds-text) 11%,transparent)}}` : '';

export function renderCss(concept, scene = null, identity = null, project = {}) {
  const vs = concept.visualSystem;
  const used = concept.homepage.sectionOrder;
  const speedMs = (key, fallback) => Math.round(fallback * 100 / Math.min(200, Math.max(50, Number(project?.[key]) || 100)));
  const motionSpeedCss = `:root{--uds-reveal-duration:${speedMs('revealSpeed', 650)}ms;--uds-text-reveal-duration:${speedMs('textRevealSpeed', 1200)}ms}.hero h1,.hero .kicker{animation-duration:var(--uds-text-reveal-duration,1.2s)!important}`;
  return [
    CORE_CSS, tokensCss(vs), visualIdentityCss(identity), themeCss(concept, identity), BASE_CSS, BUTTON_CSS[vs.button.id], NAV_CSS[vs.nav], HEADER_OVERLAY_CSS, HERO_CSS[vs.archetype], sectionLayoutCss(vs.sectionLayout),
    '.uds-testimonials,.uds-team,.uds-stats,.uds-pricing,.uds-cases{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:clamp(16px,2.5vw,28px)}.uds-testimonial,.uds-team-card,.uds-stat,.uds-pricing-card,.uds-case{margin:0;padding:clamp(18px,2.5vw,28px);border:1px solid var(--ds-border);border-radius:var(--ds-radius-md);background:var(--ds-surface);color:var(--ds-text)}.uds-testimonial blockquote{margin:0 0 14px;font:inherit}.uds-testimonial figcaption,.uds-team-card p,.uds-stat span,.uds-case p,.uds-pricing-card p{color:var(--ds-text-muted)}.uds-team-card img,.uds-case img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--ds-radius-md);margin-bottom:14px}.uds-team-card h3,.uds-case h3,.uds-pricing-card h3{margin:0 0 8px}.uds-team-card p,.uds-case p,.uds-pricing-card p{margin:0}.uds-stats{grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr))}.uds-stat{display:grid;gap:8px}.uds-stat strong,.uds-pricing-card__price{font:600 clamp(1.5rem,3vw,2.4rem)/1.1 var(--ds-font-display)}.uds-pricing-card{display:flex;flex-direction:column;align-items:flex-start;gap:14px}.uds-pricing-card__index{font-size:.8rem;color:var(--ds-text-muted)}.uds-pricing-card__price{margin-top:auto;padding-top:12px;color:var(--ds-text)}.uds-pricing-card .ds-button{margin-top:8px}.uds-case{display:grid;align-content:start;gap:14px}.uds-quiz{display:grid;gap:22px;max-width:820px}.uds-quiz fieldset{margin:0;padding:0;border:0}.uds-quiz legend{margin-bottom:12px;font-weight:700}.uds-quiz__choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:10px}.uds-quiz__choice{display:flex;align-items:flex-start;gap:10px;min-height:48px;padding:13px 15px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-md);background:var(--ds-surface);cursor:pointer}.uds-quiz__choice:has(input:checked){border-color:var(--ds-accent);box-shadow:0 0 0 1px var(--ds-accent)}.uds-quiz__choice input{margin:4px 0 0;accent-color:var(--ds-accent)}.uds-quiz__result{padding:14px 16px;border-left:3px solid var(--ds-accent);background:var(--ds-surface);border-radius:var(--ds-radius-sm)}@media(prefers-reduced-motion:reduce){.uds-quiz__choice{scroll-behavior:auto}}',
    '.ds-art{object-position:var(--ds-crop-desktop,50% 50%)}@media(max-width:900px){.ds-art{object-position:var(--ds-crop-tablet,var(--ds-crop-desktop,50% 50%))}}@media(max-width:600px){.ds-art{object-position:var(--ds-crop-mobile,var(--ds-crop-tablet,var(--ds-crop-desktop,50% 50%)))}}.nav__brand{display:inline-flex;align-items:center;gap:10px}.nav__tagline{display:block;font-size:.72em;color:var(--ds-text-muted)}.form__status{margin:0;padding:10px 12px;border:1px solid var(--ds-border);border-left:3px solid var(--ds-accent);border-radius:var(--ds-radius-sm);color:var(--ds-text)}.form__status[data-state="error"]{border-left-color:#b42318}.form__status[data-state="success"]{border-left-color:#147d46}.foot__links{display:flex;flex-wrap:wrap;gap:8px 14px}',
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
    used.includes('items') ? '.items__more{margin-top:16px}.items__more>summary{width:max-content;max-width:100%;padding:10px 16px;border:1px solid var(--ds-border);border-radius:var(--ds-radius-md);cursor:pointer}.items__more[open]>summary{margin-bottom:16px}' : '',
    // Motion CSS подключается последним: стеклянные поверхности сохраняются поверх базовых стилей карточек.
    motionCss(vs.motionPlan),
    siteMotionCss(vs, HERO_PHOTO_BG.has(vs.archetype)),
    sceneCss(scene),
    cinematicLayersCss(vs.cinematicLayers),
    sectionBackdropsCss(vs.sectionBackdrops),
    transitionCss(vs.transition, vs.sectionLayout),
    cardShapeCss('rounded'),
    photoCompositionCss(vs.photoComposition),
    sectionCompositionsCss(vs.sectionCompositions),
    siteRevealActive(vs) ? revealCss(vs.variety?.revealForced ? vs.variety.reveal : 'luxury-reveal') : '',
    vs.effects ? cardEffectCss(vs.effects.card) + heroEffectCss(vs.effects, vs.palette) : '',
    vs.typography2 ? typeStyleCss(vs.typography2.typeStyle) + textAnimationCss(vs.typography2.textAnimation) + buttonAnimationCss(compatibleButtonAnimation(vs)) : '',
    motionSpeedCss,
    '.ds-button{border-radius:999px!important}',
    TEXT_FIT_CSS,
  ].join('\n').replace(/\n\s*/g, '');
}

/** Возвращает полный HTML главной страницы. */
export function renderSite(input, concept) {
  const project = normalizeProject(input);
  const c = context(project, concept);
  const vs = c.vs;
  const scene = directScene(concept, project);
  // Визуальная идентичность включается явно: старые проекты сохраняют прежний вид без миграции.
  let visualIdentity = null;
  if (project.passthrough.visualIdentityEnabled === true) {
    try {
      visualIdentity = createVisualIdentity({
        concept, businessType: project.niche, businessName: project.brand, identitySeed: project.id,
        paletteId: project.passthrough.visualIdentityPaletteId || undefined,
        shapeId: project.passthrough.visualIdentityShapeId || undefined,
      });
    } catch { visualIdentity = null; }
  }
  const sceneLayer = sceneMarkup(scene, cinematicLightMarkup(vs.cinematicLayers) + heroEffectMarkup(vs.effects, project));
  const desc = project.seoDescription || project.description || project.mainOffer || '';
  const pageTitle = project.seoTitle || (c.title === c.brand ? c.brand : `${c.title} — ${c.brand}`);
  // Пользовательские блоки остаются между разделами; визуальные разделители секций отключены.
  const anchors = ['hero', ...c.order, 'contact'];
  const availableAnchors = new Set(anchors);
  const placedBlocks = (project.passthrough.canvasBlocks || []).map(block =>
    availableAnchors.has(block?.after) ? block : { ...block, after: 'contact' });
  const canvasElements = project.passthrough.canvasElements || {};
  const placeElements = (html, sectionId) => {
    const elements = canvasElementsHtml(canvasElements[sectionId]);
    if (!elements) return html;
    const closing = html.lastIndexOf('</section>');
    if (closing < 0) return html;
    if (sectionId === 'hero') return html.slice(0, closing) + elements + html.slice(closing);
    const containerClosing = html.lastIndexOf('</div>', closing);
    const at = containerClosing >= 0 ? containerClosing : closing;
    return html.slice(0, at) + elements + html.slice(at);
  };
  const blocksAfter = Object.fromEntries(anchors.map(anchor => [anchor, canvasBlocksHtml(placedBlocks, anchor, canvasElements)]));
  const sectionSequence = [blocksAfter.hero, ...c.order.flatMap(id => id === 'contact'
    ? [blocksAfter.contact, placeElements(SECTION[id](c), id)]
    : [placeElements(SECTION[id](c), id), blocksAfter[id]])];
  if (!c.order.includes('contact')) sectionSequence.push(blocksAfter.contact);
  const sections = sectionSequence.filter(Boolean).join('\n' + transitionHtml(c.vs.transition) + '\n');
  const foot = [project.contacts.phone, project.contacts.email, project.contacts.address].filter(Boolean).map(esc).join(' · ');
  const siteLinks = project.site.links.map(link => `<a href="${esc(link.href)}">${esc(link.label)}</a>`).join(' · ');
  const pageSocialState = project.fieldStates?.['images.social'];
  const siteSocialState = project.site?.fieldStates?.['images.social'];
  const siteSocialManualEmpty = pageSocialState !== 'manual' && siteSocialState === 'manual' && !project.site?.socialImage && !project.images.social;
  const socialImageSuppressed = pageSocialState === 'hidden' || (pageSocialState !== 'manual' && siteSocialState === 'hidden' && !project.images.social) || pageSocialState === 'manual' && !project.images.social || siteSocialManualEmpty;
  const shareImage = socialImageSuppressed ? '' : project.images.social || project.images.hero || project.site.logo;
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
${shareImage ? `<meta property="og:image" content="${esc(shareImage)}">` : ''}
<meta name="theme-color" content="${vs.palette.bg}">
<meta name="generator" content="Unique Design Studio">
${fontLinks(visualIdentity ? visualIdentityFonts(visualIdentity) : vs.typography.webFonts)}<style>${renderCss(concept, scene, visualIdentity, project.passthrough)}</style>
${jsonLd(c)}
</head>
<body id="top" class="arch-${vs.archetype} nav-${vs.nav} section-layout-${vs.sectionLayout || 'editorial'}">
<a class="skip" href="#main">${systemCopy(project.lang, 'skip')}</a>
${nav(c)}
<main id="main">
${placeElements(`<section class="hero hero--${vs.archetype} is-${vs.placement}${heroBackground(c) ? ' has-photo-bg' : ''}" data-scene="${scene.type}" data-motion-section aria-labelledby="hero-h">${sceneLayer}${heroBackground(c)}${HERO[vs.archetype](c)}</section>`, 'hero')}
${transitionHtml(c.vs.transition)}
${sections}
</main>
<footer class="foot" data-motion-section><div class="ds-container"><span>${esc(c.brand)}${project.niche ? ' — ' + esc(project.niche) : ''}${project.site.footer.note ? ` · ${esc(project.site.footer.note)}` : ''}${project.site.footer.copyright ? ` · ${esc(project.site.footer.copyright)}` : ''}</span>${foot ? `<span>${foot}</span>` : ''}${siteLinks ? `<nav class="foot__links" aria-label="${project.lang.startsWith('en') ? 'Site links' : 'Ссылки сайта'}">${siteLinks}</nav>` : ''}</div></footer>
${vs.commerce?.cart && c.order.includes('items') ? cartPanel(project) : ''}
${script(c, scene)}
${canvasOrderRuntime(project.passthrough.canvasOrder)}
${canvasMovesRuntime(project.passthrough.canvasMoves)}
${canvasEditsRuntime(project.passthrough.canvasEdits)}
</body>
</html>
`;
}


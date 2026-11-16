// Статический анализ публичной страницы: структура, визуальная система, UX и контент.
// На входе — HTML и (если удалось получить) CSS. Модуль ничего не загружает из сети и ничего не выдумывает:
// каждое значение получено из разметки и стилей; чего в исходных данных нет — помечается как «не определено».
import { classOf, closest, elements, find, findAll, parseHtml, textOf, walk } from './html-lite.js';
import { contrast, hexToHsl, hslToHex, luminance } from './color.js';

const MAX_CSS = 2_000_000;
// Сервисы шрифтов отдают только @font-face — для анализа стилей они не нужны.
const FONT_HOST = /^https?:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|fonts\.bunny\.net)\//i;
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };

// ---------- Типы блоков ----------
export const BLOCK_TYPES = {
  header: 'Шапка', hero: 'Первый экран', items: 'Каталог / услуги', pricing: 'Тарифы и цены', advantages: 'Преимущества',
  process: 'Этапы работы', gallery: 'Галерея / портфолио', reviews: 'Отзывы', faq: 'Вопросы и ответы', about: 'О компании',
  team: 'Команда', partners: 'Партнёры и клиенты', stats: 'Цифры и факты', blog: 'Блог / новости', contact: 'Контакты и заявка',
  cta: 'Призыв к действию', content: 'Контентный блок', footer: 'Подвал',
};
/** Соответствие типов блоков секциям движка студии. */
export const BLOCK_TO_SECTION = { items: 'items', pricing: 'items', advantages: 'advantages', stats: 'advantages', process: 'process', gallery: 'gallery', faq: 'faq', about: 'about', team: 'about', contact: 'contact' };

const BLOCK_RULES = [
  ['hero', /\b(hero|banner|intro|first-?screen|jumbotron|masthead|main-?screen|promo)\b/],
  ['faq', /faq|вопрос|question|accordion/],
  ['reviews', /отзыв|review|testimonial|feedback(?!-form)/],
  ['pricing', /тариф|прайс|стоимост|pricing|price-?list|plans\b|tariff/],
  ['process', /этап|как мы работа|как это работа|как заказать|шаг|process|steps|how-?it-?works|workflow|timeline/],
  ['advantages', /преимущ|почему|выгод|benefit|feature|advantage|\bwhy\b|usp/],
  ['gallery', /галере|портфолио|наши работы|кейс|gallery|portfolio|cases|\bworks\b|showcase/],
  ['team', /команда|специалист|мастера|врачи|\bteam\b|staff|experts/],
  ['partners', /партн[её]р|нам доверя|наши клиенты|partners|clients|logos|brands/],
  ['stats', /в цифрах|цифры|numbers|stats|counter|achievement/],
  ['blog', /блог|новост|стать[ия]|\bblog\b|\bnews\b|articles|journal/],
  ['items', /услуг|каталог|товар|продук|меню|коллекци|ассортимент|направлени|service|catalog|product|\bshop\b|\bmenu\b|collection|offers/],
  ['about', /о нас|о компании|о себе|о студии|о бренде|about|истори|mission|миссия/],
  ['contact', /контакт|связаться|связь|заявк|записаться|запись|contact|callback|адрес|address|\bmap\b/],
];
const PRICE = /\d[\d\s.,]*\s?(₽|руб|р\.|\$|€|usd|eur|тг|₸|грн)/i;

function classify(node, info) {
  if (node.tag === 'header') return 'header';
  if (node.tag === 'footer') return 'footer';
  if (node.tag === 'nav') return 'header';
  const key = `${node.attrs.id || ''} ${classOf(node)}`.toLowerCase();
  for (const [type, re] of BLOCK_RULES) if (re.test(key)) return type;
  if (info.hasH1) return 'hero';
  const heading = info.headingFull.toLowerCase();
  for (const [type, re] of BLOCK_RULES) if (type !== 'hero' && heading && re.test(heading)) return type;
  if (info.details >= 2) return 'faq';
  if (info.forms.length && !info.forms.every(f => f.search)) return 'contact';
  if (info.cards && info.cards.parts.includes('цена')) return 'items';
  if (info.images >= 4 && info.textLength < info.images * 80) return 'gallery';
  if (info.cards) return 'items';
  if (info.cta.length && info.textLength < 260) return 'cta';
  return 'content';
}

// ---------- CTA, формы, карточки ----------
const NOISE_BTN = /burger|hamburger|toggle|close|slider|swiper|arrow|prev|next|carousel|dropdown|accordion|tab\b|tabs|search|lang|cookie|scroll|play|pause|dots?\b/;
function ctaOf(node) {
  const tag = node.tag, cls = classOf(node);
  const isBtn = tag === 'button' || (tag === 'input' && /^(submit|button)$/i.test(node.attrs.type || ''))
    || (tag === 'a' && (/(^|[\s_-])(btn|button|cta)([\s_-]|$)/.test(cls) || node.attrs.role === 'button'));
  if (!isBtn || NOISE_BTN.test(cls)) return null;
  const label = cut(tag === 'input' ? node.attrs.value : textOf(node) || node.attrs['aria-label'], 40);
  if (!label || label.length < 2 || /^(×|x|✕|меню|menu|закрыть|close)$/i.test(label)) return null;
  const href = (node.attrs.href || '').trim();
  let kind = 'действие на странице';
  if (/^tel:/i.test(href)) kind = 'звонок';
  else if (/^mailto:/i.test(href)) kind = 'письмо';
  else if (/wa\.me|whatsapp|t\.me|telegram|viber|vk\.me|vk\.com\/im/i.test(href)) kind = 'мессенджер';
  else if (/^#/.test(href)) kind = 'якорь на блок страницы';
  else if (href && !/^javascript:/i.test(href)) kind = 'переход на другую страницу';
  else if (tag !== 'a' && closest(node, n => n.tag === 'form')) kind = 'отправка формы';
  return { label, kind, href };
}

function fieldKind(n) {
  const type = (n.attrs.type || (n.tag === 'input' ? 'text' : n.tag)).toLowerCase();
  const hint = `${n.attrs.name || ''} ${n.attrs.placeholder || ''} ${n.attrs.id || ''} ${n.attrs['aria-label'] || ''} ${n.attrs.autocomplete || ''}`.toLowerCase();
  if (type === 'search' || /search|поиск/.test(hint)) return 'поиск';
  if (type === 'tel' || /phone|tel|телефон/.test(hint)) return 'телефон';
  if (type === 'email' || /e-?mail|почт/.test(hint)) return 'e-mail';
  if (type === 'password') return 'пароль';
  if (type === 'checkbox') return /agree|consent|policy|соглас|политик/.test(hint) ? 'согласие' : 'флажок';
  if (type === 'radio') return 'переключатель';
  if (type === 'file') return 'файл';
  if (/^(date|time|datetime-local)$/.test(type) || /date|дата|время/.test(hint)) return 'дата / время';
  if (type === 'number' || type === 'range') return 'число';
  if (n.tag === 'select') return 'выбор из списка';
  if (n.tag === 'textarea' || /message|comment|сообщ|коммент|вопрос/.test(hint)) return 'сообщение';
  if (/name|имя|фио/.test(hint)) return 'имя';
  return 'текст';
}

function formInfo(form, root) {
  const inputs = findAll(form, n => (n.tag === 'input' && !/^(hidden|submit|button|reset|image)$/i.test(n.attrs.type || '')) || n.tag === 'select' || n.tag === 'textarea');
  const labels = new Set(findAll(root, 'label').map(l => l.attrs.for).filter(Boolean));
  const unlabeled = inputs.filter(n => !(n.attrs.id && labels.has(n.attrs.id)) && !n.attrs['aria-label'] && !n.attrs['aria-labelledby'] && !closest(n, p => p.tag === 'label')).length;
  const kinds = inputs.map(fieldKind);
  const submit = findAll(form, n => n.tag === 'button' || (n.tag === 'input' && /^submit$/i.test(n.attrs.type || ''))).map(ctaOf).filter(Boolean)[0];
  return {
    fields: kinds, required: inputs.filter(n => 'required' in n.attrs).length, unlabeled,
    submit: submit ? submit.label : '', search: kinds.length > 0 && kinds.every(k => k === 'поиск'),
  };
}

function cardGroup(block) {
  let best = null;
  walk(block, node => {
    if (['nav', 'header', 'footer', 'form', 'select', 'table', 'svg'].includes(node.tag)) return false;
    const kids = elements(node).filter(k => !['script', 'style', 'br', 'hr'].includes(k.tag));
    if (kids.length < 3) return;
    const sig = new Map();
    for (const k of kids) inc(sig, `${k.tag}.${classOf(k).split(/\s+/)[0] || ''}`);
    const [name, count] = top(sig, 1)[0];
    if (count < 3 || count < kids.length * 0.6) return;
    const cards = kids.filter(k => `${k.tag}.${classOf(k).split(/\s+/)[0] || ''}` === name);
    const texts = cards.map(textOf);
    const avg = texts.reduce((s, t) => s + t.length, 0) / cards.length;
    const hasImg = c => Boolean(find(c, n => n.tag === 'img' || n.tag === 'picture'));
    if (avg < 18 && !cards.some(hasImg)) return;
    const share = test => cards.filter(test).length >= cards.length * 0.5;
    const parts = [];
    if (share(hasImg)) parts.push('изображение');
    else if (share(c => Boolean(find(c, n => n.tag === 'svg' || n.tag === 'i' || /icon/.test(classOf(n)))))) parts.push('иконка');
    if (share(c => Boolean(find(c, n => /^h[2-6]$/.test(n.tag) || n.tag === 'strong' || n.tag === 'b' || /title|name|heading/.test(classOf(n)))))) parts.push('заголовок');
    if (texts.filter(t => /^\s*(0?\d{1,2})[.)\s]/.test(t)).length >= cards.length * 0.6) parts.push('номер');
    if (avg > 60) parts.push('описание');
    if (texts.filter(t => PRICE.test(t)).length >= cards.length * 0.5) parts.push('цена');
    if (share(c => /★|⭐/.test(textOf(c)) || Boolean(find(c, n => /rating|stars/.test(classOf(n)))))) parts.push('рейтинг');
    if (share(c => Boolean(find(c, n => ctaOf(n) || n.tag === 'a')))) parts.push('действие');
    const group = { count: cards.length, parts };
    if (!best || group.count * (group.parts.length + 1) > best.count * (best.parts.length + 1)) best = group;
  });
  return best;
}

function cardKind(group, blockType) {
  const p = group.parts;
  if (blockType === 'reviews') return 'отзыв';
  if (blockType === 'faq') return 'вопрос — ответ';
  if (blockType === 'team') return 'карточка специалиста';
  if (blockType === 'blog') return 'анонс материала';
  if (p.includes('цена') && (p.includes('изображение') || blockType === 'items')) return 'товарная карточка';
  if (p.includes('цена')) return 'карточка тарифа';
  if (p.includes('номер')) return 'нумерованный шаг';
  if (p.includes('иконка')) return 'карточка с иконкой';
  if (p.includes('изображение')) return 'карточка с изображением';
  return 'текстовая карточка';
}

// ---------- Разбиение страницы на блоки ----------
const IGNORE = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template', 'br', 'hr', 'svg', 'iframe', 'base', 'title', 'head']);
const SECTION_TAGS = new Set(['section', 'article', 'header', 'footer', 'nav', 'aside', 'form']);
const hasHeading = n => /^h[1-4]$/.test(n.tag) || Boolean(find(n, k => /^h[1-4]$/.test(k.tag)));

function splitBlocks(nodes, depth = 0) {
  const out = [];
  for (const node of nodes) {
    if (IGNORE.has(node.tag)) continue;
    if (node.attrs.hidden != null || /display:\s*none/i.test(node.attrs.style || '')) continue;
    const kids = elements(node).filter(k => !IGNORE.has(k.tag));
    const sectionKids = kids.filter(k => SECTION_TAGS.has(k.tag)).length;
    const headingKids = kids.filter(hasHeading).length;
    const ownHeading = kids.some(k => /^h[1-4]$/.test(k.tag));
    const wrapper = node.tag === 'main' || node.tag === 'body'
      || (!SECTION_TAGS.has(node.tag) && depth < 5 && (sectionKids >= 2 || (!ownHeading && headingKids >= 2) || (kids.length === 1 && !ownHeading && node.tag === 'div')));
    if (wrapper) { out.push(...splitBlocks(kids, depth + 1)); continue; }
    if (textOf(node).length < 12 && !find(node, k => k.tag === 'img' || k.tag === 'form' || k.tag === 'video')) continue;
    out.push(node);
  }
  return out;
}

function blockInfo(node, root) {
  const heads = findAll(node, n => /^h[1-4]$/.test(n.tag));
  const first = heads[0];
  const info = {
    hasH1: heads.some(h => h.tag === 'h1'),
    headingFull: first ? textOf(first) : '',
    heading: first ? cut(textOf(first), 48) : '',
    textLength: textOf(node).length,
    images: findAll(node, n => n.tag === 'img' || n.tag === 'picture').length,
    video: Boolean(find(node, n => n.tag === 'video' || (n.tag === 'iframe' && /youtube|vimeo|rutube|vk\.com\/video/i.test(n.attrs.src || '')))),
    bgImage: /background(-image)?:[^;]*url\(/i.test(node.attrs.style || '') || Boolean(find(node, n => /background(-image)?:[^;]*url\(/i.test(n.attrs.style || ''))),
    details: findAll(node, 'details').length,
    forms: findAll(node, 'form').concat(node.tag === 'form' ? [node] : []).map(f => formInfo(f, root)),
    cta: findAll(node, n => Boolean(ctaOf(n))).map(ctaOf),
    lists: findAll(node, n => n.tag === 'ul' || n.tag === 'ol').length,
    paragraphs: findAll(node, 'p').length,
  };
  info.cards = ['header', 'footer', 'nav'].includes(node.tag) ? null : cardGroup(node);
  info.type = classify(node, info);
  if (info.cards) info.cards.kind = cardKind(info.cards, info.type);
  return info;
}

// ---------- CSS ----------
function parseCss(source) {
  const css = String(source || '').slice(0, MAX_CSS).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [], vars = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/.test(sel) || sel.startsWith('@font-face')) continue;
    const decls = [];
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i < 1) continue;
      const prop = part.slice(0, i).trim().toLowerCase(), value = part.slice(i + 1).trim().replace(/\s*!important$/i, '');
      if (!prop || !value) continue;
      if (prop.startsWith('--')) vars[prop] = value;
      decls.push([prop, value]);
    }
    if (decls.length) rules.push({ sel: sel.toLowerCase(), decls });
  }
  const media = [...css.matchAll(/@media([^{]+)\{/g)].map(x => x[1].toLowerCase());
  return { rules, vars, media, keyframes: (css.match(/@keyframes/g) || []).length, raw: css };
}

const NAMED = { white: '#ffffff', black: '#000000' };
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
function resolveVars(value, vars, depth = 0) {
  if (depth > 4 || !value.includes('var(')) return value;
  return resolveVars(value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (m, name, fallback) => vars[name] ?? fallback ?? ''), vars, depth + 1);
}
/** Все непрозрачные цвета из значения CSS → #rrggbb. */
function colorsIn(value, vars) {
  const v = resolveVars(String(value), vars).toLowerCase();
  const out = [];
  for (const m of v.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/g)) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map(c => c + c).join('');
    if (h.length === 8 && parseInt(h.slice(6), 16) < 128) continue;
    out.push('#' + h.slice(0, 6));
  }
  for (const m of v.matchAll(/rgba?\(([^)]+)\)/g)) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(x => (x.endsWith('%') ? parseFloat(x) * 2.55 : parseFloat(x)));
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) continue;
    const alpha = p[3] == null ? 1 : m[1].trim().endsWith('%') ? p[3] / 255 : p[3];
    if (alpha < 0.5) continue;
    out.push('#' + p.slice(0, 3).map(hex2).join(''));
  }
  for (const m of v.matchAll(/hsla?\(([^)]+)\)/g)) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) continue;
    if (p[3] != null && p[3] < 0.5) continue;
    out.push(hslToHex(p[0], p[1], p[2]));
  }
  for (const [name, hex] of Object.entries(NAMED)) if (new RegExp(`(^|[\\s,(])${name}($|[\\s,;)])`).test(v)) out.push(hex);
  return out;
}
const dist = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

function toPx(value) {
  const v = String(value).trim().toLowerCase();
  const clamp = /clamp\(([^,]+),[^,]+,([^)]+)\)/.exec(v);
  if (clamp) { const a = toPx(clamp[1]), b = toPx(clamp[2]); return a && b ? Math.max(a, b) : a || b; }
  const m = /^(-?\d*\.?\d+)(px|rem|em|pt)?$/.exec(v);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2] === 'rem' || m[2] === 'em' ? n * 16 : m[2] === 'pt' ? n * 1.333 : m[2] === 'px' ? n : 0;
}

const ICON_FONT = /icon|awesome|glyph|material symbols|material icons|swiper|slick|fancybox|bootstrap-icons|remixicon/i;
function fontKind(stack) {
  const s = stack.toLowerCase();
  const name = s.split(',')[0];
  if (/mono|courier|consolas|menlo|code/.test(name)) return 'моноширинный';
  if (/condensed|narrow|oswald|bebas|din\b|impact|anton|league gothic/.test(name)) return 'узкий гротеск';
  if (/rounded|nunito|quicksand|comfortaa|varela|fredoka/.test(name)) return 'округлый гротеск';
  if (/playfair|didot|bodoni|cormorant|prata|forum/.test(name)) return 'контрастная антиква';
  if (/slab|rockwell|arvo|zilla/.test(name)) return 'брусковый';
  if (/georgia|times|garamond|merriweather|lora|literata|pt serif|noto serif|baskerville|palatino|charter|spectral|\bserif/.test(name) && !/sans/.test(name)) return 'антиква';
  if (/(^|,)\s*serif\s*$/.test(s) && !/sans-serif\s*$/.test(s)) return 'антиква';
  if (/(^|,)\s*monospace\s*$/.test(s)) return 'моноширинный';
  if (/(^|,)\s*cursive\s*$/.test(s)) return 'рукописный';
  if (/futura|avenir|montserrat|jost|poppins|century gothic|gilroy|raleway|geologica|manrope/.test(name)) return 'геометрический гротеск';
  return 'гротеск';
}
const selHas = (sel, re) => sel.split(',').some(s => re.test(s.trim()));

function analyzeVisual(cssText, inlineStyles) {
  const { rules, vars, media, keyframes, raw } = parseCss(cssText);
  for (const style of inlineStyles) {
    const decls = style.split(';').map(p => { const i = p.indexOf(':'); return i > 0 ? [p.slice(0, i).trim().toLowerCase(), p.slice(i + 1).trim()] : null; }).filter(Boolean);
    if (decls.length) rules.push({ sel: '[style]', decls });
  }
  const declCount = rules.reduce((s, r) => s + r.decls.length, 0);
  if (declCount < 12) return { available: false, declarations: declCount };

  const bg = new Map(), fg = new Map(), accentScore = new Map(), all = new Map(), border = new Map();
  const fonts = new Map(), headingFonts = new Map();
  let pageBg = '', pageText = '', bodyFont = '', bodySize = '';
  const sizes = { h1: null, h2: null, h3: null };
  const heading = { weight: new Map(), upper: 0, tracking: new Map() };
  const count = { grid: 0, flex: 0, shadows: 0, transitions: 0, animations: 0, gradients: 0, center: 0, upper: 0, sticky: 0, stickyHeader: false, backdrop: 0, objectFit: 0, focus: 0 };
  const columns = new Map(), containers = new Map(), spacing = new Map(), sectionPad = new Map(), radii = new Map();
  let pill = 0, smallFont = 0;

  for (const { sel, decls } of rules) {
    const isRoot = selHas(sel, /^(html|body|:root)$/);
    const isBody = selHas(sel, /^(html|body)$/);
    const isAction = /btn|button|cta|primary|accent|badge|submit/.test(sel);
    const isLink = selHas(sel, /^a(:link|:visited)?$/);
    const hTag = ['h1', 'h2', 'h3'].filter(h => selHas(sel, new RegExp(`(^|[\\s>+~])${h}($|[:.\\[\\s])`)));
    const isHeading = hTag.length > 0 || /title|heading|headline/.test(sel);
    if (/:focus/.test(sel)) count.focus++;
    for (const [prop, rawValue] of decls) {
      const value = resolveVars(rawValue, vars);
      if (prop === 'background' || prop === 'background-color') {
        if (/gradient\(/.test(value)) count.gradients++;
        for (const c of colorsIn(value, vars)) {
          inc(bg, c, isRoot ? 6 : 1); inc(all, c);
          if (isBody && !pageBg) pageBg = c;
          if (isAction) inc(accentScore, c, 4);
        }
      } else if (prop === 'color') {
        for (const c of colorsIn(value, vars)) {
          inc(fg, c, isRoot ? 6 : 1); inc(all, c);
          if (isBody && !pageText) pageText = c;
          if (isLink) inc(accentScore, c, 3);
        }
      } else if (/^border(-(top|right|bottom|left))?(-color)?$/.test(prop) || prop === 'outline' || prop === 'fill' || prop === 'stroke') {
        for (const c of colorsIn(value, vars)) { inc(border, c); inc(all, c); if (isAction) inc(accentScore, c, 2); }
      } else if (prop.startsWith('--')) {
        const role = /accent|primary|brand|main-color|theme/.test(prop) ? 'accent' : /bg|background|surface|paper/.test(prop) ? 'bg' : /text|ink|fg|font-color/.test(prop) ? 'fg' : '';
        for (const c of colorsIn(value, vars)) {
          inc(all, c);
          if (role === 'accent') inc(accentScore, c, 5);
          if (role === 'bg') inc(bg, c, 2);
          if (role === 'fg') inc(fg, c, 2);
        }
      } else if (prop === 'font-family') {
        const stack = value.replace(/["']/g, '').trim();
        const family = stack.split(',')[0].trim();
        if (!family || ICON_FONT.test(family) || /^(inherit|initial|unset|revert)$/i.test(family)) continue;
        inc(fonts, stack, isRoot ? 8 : 1);
        if (isBody && !bodyFont) bodyFont = stack;
        if (isHeading) inc(headingFonts, stack, hTag.length ? 3 : 1);
      } else if (prop === 'font-size') {
        for (const h of hTag) if (!sizes[h] || toPx(value) > toPx(sizes[h])) sizes[h] = value;
        if (isBody && !bodySize) bodySize = value;
        const px = toPx(value);
        if (px && px < 12) smallFont++;
      } else if (prop === 'font-weight' && hTag.length) inc(heading.weight, value);
      else if (prop === 'text-transform' && /uppercase/.test(value)) { count.upper++; if (isHeading) heading.upper++; }
      else if (prop === 'letter-spacing' && isHeading) inc(heading.tracking, value);
      else if (prop === 'display') { if (/grid/.test(value)) count.grid++; else if (/flex/.test(value)) count.flex++; }
      else if (prop === 'grid-template-columns') inc(columns, cut(value, 44));
      else if (prop === 'max-width') { const px = toPx(value); if (px >= 900 && px <= 1920) inc(containers, Math.round(px)); }
      else if (/^(padding|margin|gap|row-gap|column-gap)(-(top|right|bottom|left|block|inline))?$/.test(prop)) {
        const parts = value.split(/\s+/).map(toPx).filter(px => px > 0 && px <= 240);
        for (const px of parts) inc(spacing, Math.round(px));
        if (/^padding(-(top|bottom|block))?$/.test(prop) && parts[0] >= 48) inc(sectionPad, Math.round(parts[0]));
      } else if (prop === 'border-radius') {
        const first = value.split(/[\s/]+/)[0];
        if (/%$/.test(first) || toPx(first) >= 100) pill++;
        else inc(radii, Math.round(toPx(first)));
      } else if (prop === 'box-shadow' && value !== 'none') count.shadows++;
      else if (prop === 'transition' && value !== 'none') count.transitions++;
      else if (prop === 'animation' || prop === 'animation-name') count.animations++;
      else if (prop === 'text-align' && value === 'center') count.center++;
      else if (prop === 'position' && /sticky|fixed/.test(value)) { count.sticky++; if (/header|nav|top|menu|bar/.test(sel)) count.stickyHeader = true; }
      else if (prop === 'backdrop-filter' || prop === '-webkit-backdrop-filter') count.backdrop++;
      else if (prop === 'object-fit') count.objectFit++;
    }
  }

  const background = pageBg || (top(bg, 1)[0] || [])[0] || '';
  const text = pageText || (top(fg, 1)[0] || [])[0] || '';
  const sat = c => hexToHsl(c);
  const vivid = [...all.keys()].filter(c => { const [, s, l] = sat(c); return s >= 30 && l >= 18 && l <= 78; });
  const accents = vivid.map(c => [c, (accentScore.get(c) || 0) * 2 + (all.get(c) || 0)]).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const accent = accents[0] || '';
  const hueGap = (a, b) => { const d = Math.abs(sat(a)[0] - sat(b)[0]); return Math.min(d, 360 - d); };
  const accent2 = accents.find(c => c !== accent && hueGap(c, accent) > 28 && dist(c, accent) > 60) || '';
  const palette = [];
  const push = (hex, role) => { if (hex && !palette.some(p => dist(p.hex, hex) < 14)) palette.push({ hex, role, uses: all.get(hex) || 0 }); };
  push(background, 'фон'); push(text, 'текст'); push(accent, 'акцент'); push(accent2, 'дополнительный акцент');
  for (const [c] of top(bg, 6)) if (palette.length < 6) push(c, 'поверхность');
  for (const [c] of top(fg, 6)) if (palette.length < 7) push(c, 'вторичный текст');
  for (const [c] of top(border, 4)) if (palette.length < 8) push(c, 'границы и линии');

  const breakpoints = new Map();
  let minW = 0, maxW = 0;
  for (const q of media) for (const m of q.matchAll(/(min|max)-width:\s*(\d*\.?\d+)(px|em|rem)/g)) {
    const px = Math.round(parseFloat(m[2]) * (m[3] === 'px' ? 1 : 16));
    inc(breakpoints, px); if (m[1] === 'min') minW++; else maxW++;
  }
  const spacingTop = top(spacing, 8).map(x => x[0]);
  const unit = [8, 4, 5].find(u => spacingTop.length >= 3 && spacingTop.filter(v => v % u === 0).length >= spacingTop.length * 0.75) || 0;
  const radiusEntries = top(radii, 6);
  const nonZero = radiusEntries.filter(([v]) => v > 0);
  const dominant = nonZero.length ? nonZero[0][0] : 0;
  const radiusUses = nonZero.reduce((s, x) => s + x[1], 0);
  const shape = radiusUses + pill < 2 || dominant <= 2 && !pill ? 'sharp' : dominant <= 12 && pill <= radiusUses ? 'soft' : 'round';
  const fontList = top(fonts, 4).map(([stack, uses]) => ({ family: stack.split(',')[0].trim(), kind: fontKind(stack), uses }));
  const headStack = (top(headingFonts, 1)[0] || [])[0] || '';
  return {
    available: true, declarations: declCount, rules: rules.length,
    palette, background, text, accent, accent2,
    mode: background ? (luminance(background) < 0.22 ? 'dark' : 'light') : '',
    contrast: {
      textOnBackground: background && text ? Math.round(contrast(text, background) * 100) / 100 : 0,
      accentOnBackground: background && accent ? Math.round(contrast(accent, background) * 100) / 100 : 0,
    },
    fonts: fontList,
    headingFont: headStack ? { family: headStack.split(',')[0].trim(), kind: fontKind(headStack) } : null,
    bodyFont: bodyFont ? { family: bodyFont.split(',')[0].trim(), kind: fontKind(bodyFont) } : null,
    sizes: { ...sizes, body: bodySize },
    heading: { weight: (top(heading.weight, 1)[0] || [])[0] || '', uppercase: heading.upper, tracking: (top(heading.tracking, 1)[0] || [])[0] || '' },
    layout: {
      grid: count.grid, flex: count.flex, columns: top(columns, 3).map(x => x[0]), containers: top(containers, 2).map(x => x[0]),
      breakpoints: top(breakpoints, 6).map(x => x[0]).sort((a, b) => a - b), mediaQueries: media.length,
      approach: !media.length ? '' : minW > maxW * 1.5 ? 'mobile-first' : maxW > minW * 1.5 ? 'desktop-first' : 'смешанный',
      center: count.center,
    },
    spacing: { values: spacingTop.slice().sort((a, b) => a - b), unit, section: top(sectionPad, 3).map(x => x[0]).sort((a, b) => a - b) },
    radii: { values: radiusEntries.map(x => x[0]).sort((a, b) => a - b), dominant, pill, shape },
    effects: { shadows: count.shadows, transitions: count.transitions, animations: count.animations + keyframes, gradients: count.gradients, backdrop: count.backdrop, uppercase: count.upper },
    stickyHeader: count.stickyHeader, focusStyles: count.focus, smallFont,
    reducedMotion: /prefers-reduced-motion/.test(raw), darkScheme: /prefers-color-scheme/.test(raw),
  };
}

// ---------- Заголовки ----------
export function headingType(text) {
  const t = String(text).trim();
  if (/\?\s*$/.test(t) || /^(как|почему|что|зачем|когда|сколько|где|кто|how|why|what|when|where)\s/i.test(t)) return 'вопрос';
  if (/^(получите|закажите|выберите|запишитесь|узнайте|начните|создайте|откройте|попробуйте|оставьте|рассчитайте|get|start|try|book|order|discover|join|create|build|shop)\b/i.test(t) || /^[а-яё]+(йте|ите|ьте)\s/i.test(t)) return 'призыв';
  if (/\d/.test(t)) return 'с цифрой';
  if (/(^|\s)(для|без|под ключ|с гарантией|бесплатн|for|without)\s/i.test(t)) return 'выгода';
  if (words(t).length <= 3) return 'короткий ярлык';
  return 'утверждение';
}

// ---------- Функциональные элементы ----------
function detectFeatures(root, corpus, scripts, blocks) {
  const has = re => re.test(corpus);
  const f = [];
  const add = (cond, label) => { if (cond) f.push(label); };
  add(Boolean(find(root, n => n.tag === 'input' && (/search/i.test(n.attrs.type || '') || /search|поиск/i.test(`${n.attrs.name || ''} ${n.attrs.placeholder || ''}`)))) || has(/\bsearch-(form|box|field|input)\b/), 'поиск по сайту');
  add(has(/\b(cart|basket|minicart|корзин)/), 'корзина');
  add(has(/\b(filter|filters|facet|sort-?by)\b/), 'фильтры и сортировка');
  add(has(/swiper|slick|carousel|slider|splide|glide|owl-/), 'слайдер / карусель');
  add(has(/\btabs?\b|tab-(pane|content|list)/) || Boolean(find(root, n => n.attrs.role === 'tablist')), 'вкладки');
  add(findAll(root, 'details').length >= 2 || has(/accordion|collaps/), 'аккордеон');
  add(has(/modal|popup|fancybox|lightbox/) || Boolean(find(root, 'dialog')), 'модальные окна');
  add(Boolean(find(root, n => n.tag === 'iframe' && /maps|yandex\.[a-z]+\/map|2gis|openstreetmap/i.test(n.attrs.src || ''))) || has(/\b(ymap|yandex-map|google-map|map-container)\b/), 'карта');
  add(blocks.some(b => b.video) || Boolean(find(root, 'video')), 'видео');
  add(scripts.some(s => /jivo|tawk|intercom|crisp|livechat|carrotquest|chatra|talk-me|bitrix.*(chat|widget)|tidio/i.test(s)), 'онлайн-чат');
  add(Boolean(find(root, n => n.tag === 'a' && /wa\.me|whatsapp|t\.me|telegram|viber/i.test(n.attrs.href || ''))), 'ссылки в мессенджеры');
  add(Boolean(find(root, n => n.tag === 'a' && /^tel:/i.test(n.attrs.href || ''))), 'кликабельный телефон');
  add(has(/\b(calc|calculator|калькулятор)\b/) || Boolean(find(root, n => n.tag === 'input' && n.attrs.type === 'range')), 'калькулятор / ползунки');
  add(has(/\b(lang|language)-?(switch|select|menu|toggle)|\bhreflang/) || findAll(root, n => n.tag === 'link' && n.attrs.hreflang).length > 1, 'переключение языка');
  add(Boolean(find(root, n => n.tag === 'a' && /^(вход|войти|личный кабинет|login|log in|sign in|account)$/i.test(textOf(n)))), 'вход / личный кабинет');
  add(has(/cookie|gdpr|consent-banner/), 'баннер cookie');
  add(has(/breadcrumb|хлебн/), 'хлебные крошки');
  add(has(/pagination|pager\b/), 'пагинация');
  add(Boolean(find(root, n => n.tag === 'a' && /vk\.com|instagram|youtube|ok\.ru|dzen|facebook|tiktok|pinterest|linkedin/i.test(n.attrs.href || ''))), 'ссылки на соцсети');
  add(has(/\b(to-top|scroll-top|back-to-top|scrollup)\b/), 'кнопка «наверх»');
  add(has(/\b(countdown|timer)\b/), 'таймер');
  add(has(/\b(favorite|wishlist|compare|избранн)/), 'избранное / сравнение');
  add(Boolean(find(root, n => n.tag === 'script' && /application\/ld\+json/i.test(n.attrs.type || ''))), 'микроразметка JSON-LD');
  return f;
}

// ---------- Анализ одной страницы ----------
/**
 * @param {{url?:string, html:string, css?:string, cssLoaded?:number}} input
 * @returns объект с измеренными характеристиками страницы
 */
export function analyzePage({ url = '', html = '', css = '', cssLoaded = 0 } = {}) {
  const root = parseHtml(html);
  const body = find(root, 'body') || root;
  const head = find(root, 'head') || root;
  const htmlEl = find(root, 'html');
  const meta = name => (find(root, n => n.tag === 'meta' && (n.attrs.name || n.attrs.property || '').toLowerCase() === name) || { attrs: {} }).attrs.content || '';
  const title = cut(textOf(find(head, 'title') || { children: [] }), 90);
  const all = findAll(root, () => true);
  const corpus = all.map(n => `${classOf(n)} ${(n.attrs.id || '').toLowerCase()}`).join(' ');
  const scripts = findAll(root, 'script').map(s => s.attrs.src || '').filter(Boolean);
  const bodyText = textOf(body);
  const warnings = [];

  const resolve = href => { try { return new URL(href, url || undefined).href; } catch { return ''; } };
  const stylesheets = findAll(root, n => n.tag === 'link' && /stylesheet/i.test(n.attrs.rel || '') && n.attrs.href).map(n => resolve(n.attrs.href)).filter(u => /^https?:/i.test(u) && !FONT_HOST.test(u));
  const inlineCss = findAll(root, 'style').map(s => (s.children[0] || {}).text || '').join('\n');
  const inlineStyles = all.map(n => n.attrs.style).filter(Boolean);
  const googleFonts = [...new Set(findAll(root, n => n.tag === 'link' && /fonts\.googleapis\.com/i.test(n.attrs.href || ''))
    .flatMap(n => [...String(n.attrs.href).matchAll(/family=([^&:]+)/g)].map(m => decodeURIComponent(m[1]).replace(/\+/g, ' '))))];

  const jsApp = bodyText.length < 200 && scripts.length > 0 && Boolean(find(body, n => /^(root|app|__next|__nuxt|svelte)$/i.test(n.attrs.id || '')));
  if (!html.trim()) warnings.push('HTML страницы пуст — анализировать нечего.');
  else if (jsApp) warnings.push('Страница собирается JavaScript-ом: в исходном HTML почти нет содержимого. Откройте сайт в браузере и скопируйте готовую разметку (инструкция в блоке «HTML-код страницы»).');
  else if (bodyText.length < 200) warnings.push('В HTML очень мало текста — возможно, содержимое подгружается скриптами или страница закрыта.');
  if (/captcha|cf-challenge|challenge-platform|ddos-guard|are you a robot|доступ ограничен|access denied/i.test(html.slice(0, 60000)) && bodyText.length < 1500) {
    warnings.push('Похоже, вместо страницы получена проверка «я не робот» или отказ в доступе. Студия не обходит такие защиты — добавьте данные вручную.');
  }

  // --- Структура ---
  const nodes = splitBlocks(elements(body));
  const blocks = nodes.map(n => ({ node: n, ...blockInfo(n, root) }));
  // Первый экран — только первый блок с h1; остальные «hero» по классу остаются, дубли типов допустимы.
  const firstContent = blocks.find(b => !['header', 'footer'].includes(b.type));
  if (firstContent && !blocks.some(b => b.type === 'hero') && firstContent.type === 'content') firstContent.type = 'hero';
  const hero = blocks.find(b => b.type === 'hero') || null;

  const navNode = find(body, n => n.tag === 'nav') || find(body, n => n.tag === 'header');
  const navLinks = navNode ? findAll(navNode, 'a').filter(a => textOf(a) && !ctaOf(a) && !/^(tel|mailto):/i.test(a.attrs.href || '')) : [];
  const topLinks = navLinks.filter(a => !closest(a.parent, n => n.tag === 'ul' && closest(n.parent, p => p.tag === 'li')));
  const headerNode = find(body, 'header') || navNode;
  const nav = {
    present: Boolean(navNode), items: topLinks.length || navLinks.length,
    labels: (topLinks.length ? topLinks : navLinks).slice(0, 12).map(a => cut(textOf(a), 24)),
    dropdown: navLinks.length > topLinks.length && topLinks.length > 0,
    anchors: navLinks.filter(a => /^#|\/#/.test(a.attrs.href || '')).length,
    burger: /burger|hamburger|menu-(toggle|btn|button|icon)|nav-(toggle|btn)|navbar-toggler|mobile-menu/.test(corpus) || Boolean(find(body, n => n.tag === 'button' && /меню|menu|navigation/i.test(n.attrs['aria-label'] || ''))),
    phone: headerNode ? Boolean(find(headerNode, n => n.tag === 'a' && /^tel:/i.test(n.attrs.href || ''))) : false,
    cta: headerNode ? findAll(headerNode, n => Boolean(ctaOf(n))).map(ctaOf).map(c => c.label)[0] || '' : '',
    search: headerNode ? Boolean(find(headerNode, n => n.tag === 'input' && /search|поиск/i.test(`${n.attrs.type || ''} ${n.attrs.name || ''} ${n.attrs.placeholder || ''}`))) : false,
  };

  const forms = [], cards = [], ctas = [];
  blocks.forEach((b, i) => {
    for (const f of b.forms) forms.push({ ...f, block: b.type });
    if (b.cards) cards.push({ ...b.cards, block: b.type });
    for (const c of b.cta) ctas.push({ ...c, block: b.type, index: i });
  });
  const features = detectFeatures(root, corpus, scripts, blocks);

  // --- Визуальная система ---
  const visual = analyzeVisual(`${css}\n${inlineCss}`, inlineStyles);
  visual.googleFonts = googleFonts;
  visual.sources = { external: stylesheets.length, loaded: cssLoaded, inlineBlocks: findAll(root, 'style').length, inlineAttributes: inlineStyles.length };
  // Разметка, скопированная из браузера сниппетом студии, уже содержит правила доступных таблиц стилей.
  const collected = find(root, n => n.tag === 'style' && 'data-uds-collected' in n.attrs);
  if (collected) cssLoaded = Math.max(cssLoaded, stylesheets.length - (parseInt(collected.attrs['data-uds-skipped'], 10) || 0));
  visual.sources.loaded = cssLoaded;
  if (stylesheets.length > cssLoaded) {
    warnings.push(visual.available
      ? `Внешние таблицы стилей получены не полностью (${cssLoaded} из ${stylesheets.length}) — палитра, типографика и сетка определены частично.`
      : `Внешние таблицы стилей не получены (${stylesheets.length}) — визуальную систему нужно описать вручную или добавить CSS.`);
  } else if (!visual.available) warnings.push('Стилей в полученных данных недостаточно — визуальную систему нужно описать вручную.');

  // --- Контент ---
  const headings = findAll(body, n => /^h[1-3]$/.test(n.tag)).map(n => ({ level: Number(n.tag[1]), text: textOf(n) })).filter(h => h.text);
  const types = new Map();
  for (const h of headings) inc(types, headingType(h.text));
  const levels = [1, 2, 3].map(l => headings.filter(h => h.level === l).length);
  const ctaLabels = new Map();
  for (const c of ctas) inc(ctaLabels, c.label.toLowerCase());
  const primary = top(ctaLabels, 1)[0];

  // --- UX ---
  const imgs = findAll(body, 'img');
  const noAlt = imgs.filter(i => !('alt' in i.attrs)).length;
  const viewport = meta('viewport');
  const contentBlocks = blocks.filter(b => !['header', 'footer'].includes(b.type));
  const firstCtaIndex = contentBlocks.findIndex(b => b.cta.length);
  const lastBlock = contentBlocks[contentBlocks.length - 1];
  const issues = [];
  const issue = (cond, text) => { if (cond) issues.push(text); };
  issue(!viewport, 'нет meta viewport — на телефонах страница не масштабируется под экран');
  issue(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\D|$)/i.test(viewport), 'масштабирование жестами запрещено в meta viewport');
  issue(levels[0] === 0, 'нет заголовка h1');
  issue(levels[0] > 1, `несколько заголовков h1 (${levels[0]}) — иерархия размыта`);
  issue(levels[1] === 0 && levels[2] > 0, 'заголовки h3 используются без h2 — пропуск уровня');
  issue(noAlt > 0, `изображения без атрибута alt: ${noAlt} из ${imgs.length}`);
  issue(nav.items > 8, `в главном меню ${nav.items} пунктов — больше 7–8 сложно просматривать`);
  issue(contentBlocks.length > 2 && firstCtaIndex < 0 && !nav.cta, 'на странице не найдено кнопок действия');
  issue(firstCtaIndex > 0 && !nav.cta, 'на первом экране нет кнопки действия');
  issue(ctaLabels.size > 6, `много разных формулировок CTA (${ctaLabels.size}) — главное действие теряется`);
  issue(forms.some(f => f.unlabeled > 0 && !f.search), 'в формах есть поля без подписи (label или aria-label)');
  issue(forms.some(f => f.fields.length > 6 && !f.search), 'длинная форма: больше 6 полей');
  if (visual.available) {
    issue(!visual.layout.mediaQueries && stylesheets.length <= cssLoaded, 'в стилях нет медиа-запросов — адаптация под телефон не подтверждена');
    issue(visual.contrast.textOnBackground > 0 && visual.contrast.textOnBackground < 4.5, `контраст основного текста и фона ${visual.contrast.textOnBackground}:1 — ниже 4.5:1`);
    issue(visual.smallFont > 2, `встречается кегль меньше 12px (${visual.smallFont} правил)`);
    issue(!visual.focusStyles, 'в стилях нет состояний :focus — навигация с клавиатуры не видна');
  }
  issue(!htmlEl || !htmlEl.attrs.lang, 'у <html> не указан язык (lang)');
  issue(!meta('description'), 'нет meta description');
  issue(findAll(body, n => n.tag === 'a' && !textOf(n) && !n.attrs['aria-label'] && !find(n, k => k.tag === 'img' && k.attrs.alt)).length > 2, 'есть ссылки без текста и подписи');

  return {
    url, title, lang: htmlEl ? htmlEl.attrs.lang || '' : '', description: Boolean(meta('description')),
    stats: { htmlBytes: html.length, cssBytes: css.length + inlineCss.length, elements: all.length, textLength: bodyText.length, images: imgs.length, stylesheets },
    rendering: jsApp ? 'js-app' : 'static',
    structure: {
      blocks: blocks.map(({ node, ...b }) => b),
      order: contentBlocks.map(b => b.type),
      nav, forms, cards, cta: ctas, features, hero: hero ? { images: hero.images, video: hero.video, bgImage: hero.bgImage, form: hero.forms.some(f => !f.search), cta: hero.cta.length, heading: hero.headingFull } : null,
    },
    visual,
    ux: {
      viewport: Boolean(viewport), firstCtaIndex, ctaAtEnd: Boolean(lastBlock && lastBlock.cta.length), ctaInHeader: nav.cta,
      contacts: [
        features.includes('кликабельный телефон') && 'телефон', Boolean(find(body, n => n.tag === 'a' && /^mailto:/i.test(n.attrs.href || ''))) && 'e-mail',
        features.includes('ссылки в мессенджеры') && 'мессенджеры', forms.some(f => !f.search) && 'форма', features.includes('онлайн-чат') && 'чат',
      ].filter(Boolean),
      responsiveImages: imgs.filter(i => i.attrs.srcset || closest(i, n => n.tag === 'picture')).length,
      lazyImages: imgs.filter(i => /lazy/i.test(i.attrs.loading || '')).length,
      issues,
    },
    content: {
      headings: { total: headings.length, levels, types: Object.fromEntries(types), avgWords: headings.length ? Math.round(headings.reduce((s, h) => s + words(h.text).length, 0) / headings.length * 10) / 10 : 0 },
      heroWords: hero ? words(hero.headingFull).length : 0,
      heroHasLead: hero ? hero.paragraphs > 0 : false,
      proof: /\d+\s*(\+|лет|года?|клиент|проект|отзыв|%)|★|⭐/i.test(hero ? textOf(hero.node) : ''),
      primaryCta: primary ? { label: primary[0], repeats: primary[1] } : null,
      ctaLabels: ctaLabels.size,
    },
    warnings,
  };
}

// ---------- Профиль шаблона из анализа ----------
const label = type => BLOCK_TYPES[type] || type;
const pathOf = url => { try { const u = new URL(url); return (u.pathname === '/' ? 'Главная' : decodeURIComponent(u.pathname)) + (u.search ? ' (с параметрами)' : ''); } catch { return 'Страница'; } };
const join = arr => arr.filter(Boolean).join(', ');

function blockLine(b, i) {
  const bits = [];
  if (b.cards) bits.push(`${b.cards.count} ${plural(b.cards.count, 'карточка', 'карточки', 'карточек')} (${b.cards.kind})`);
  if (b.forms.some(f => !f.search)) bits.push('форма');
  if (b.cta.length) bits.push(`${b.cta.length} CTA`);
  if (b.video) bits.push('видео'); else if (b.images) bits.push(`${b.images} изобр.`);
  if (b.details >= 2) bits.push('аккордеон');
  return `${i + 1}. ${label(b.type)}${bits.length ? ' — ' + bits.join(', ') : ''}`;
}

/** Оценка близких архитектур студии по измеренным признакам (это оценка, а не измерение). */
function guessArchetypes(page) {
  const s = page.structure, score = {};
  const add = (id, n) => { score[id] = (score[id] || 0) + n; };
  const blocks = s.blocks.filter(b => !['header', 'footer'].includes(b.type));
  const priced = s.cards.filter(c => c.parts.includes('цена'));
  const maxCards = Math.max(0, ...s.cards.map(c => c.count));
  if (s.hero && s.hero.form) add('split-utility', 4);
  if (s.hero && (s.hero.video || s.hero.bgImage)) add('immersive', 4);
  if (priced.length && maxCards >= 8) add('catalog', 4);
  if (s.features.includes('корзина') || s.features.includes('фильтры и сортировка')) add('catalog', 3);
  if (priced.length && maxCards < 8) add('product-first', 3);
  if (blocks.length <= 4) add('minimal', 3);
  if (s.order.includes('process') && s.order.includes('about')) add('storytelling', 2);
  if (page.visual.available && page.visual.layout.grid >= 8 && s.cards.length >= 3) add('modular-grid', 3);
  if (page.visual.available && page.visual.headingFont && /антиква/.test(page.visual.headingFont.kind)) add('editorial', 3);
  if (page.visual.available && page.visual.radii.shape === 'sharp' && page.visual.heading.uppercase > 1 && page.visual.effects.shadows < 2) add('brutalist', 2);
  if (s.forms.some(f => !f.search) && !score['split-utility']) add('split-utility', 1);
  return Object.entries(score).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
}

function typeCharacter(visual) {
  const f = visual.available && (visual.headingFont || visual.bodyFont || visual.fonts[0]);
  if (!f) return '';
  return {
    'моноширинный': 'mono-technical', 'узкий гротеск': 'condensed-caps', 'округлый гротеск': 'rounded-friendly', 'контрастная антиква': 'didone-contrast',
    'брусковый': 'slab-sturdy', 'антиква': 'serif-editorial', 'геометрический гротеск': 'geometric-clean',
  }[f.kind] || 'grotesque-tight';
}

/**
 * Сводит анализ одной или нескольких страниц в редактируемый профиль шаблона.
 * @returns {{profile:object, traits:object, warnings:string[]}}
 */
export function buildProfile(pages) {
  const list = (pages || []).filter(Boolean);
  if (!list.length) return { profile: {}, traits: {}, warnings: ['Нет проанализированных страниц.'] };
  const main = list[0], s = main.structure, v = main.visual, c = main.content, u = main.ux;
  const content = s.blocks.filter(b => !['header', 'footer'].includes(b.type));
  const P = {};

  P.pageStructure = list.map(p => `${pathOf(p.url)}: ${p.structure.order.map(label).join(' → ') || 'блоки не распознаны'} (${p.structure.order.length} ${plural(p.structure.order.length, 'блок', 'блока', 'блоков')})`);
  P.blocks = list.flatMap((p, pi) => [...(list.length > 1 ? [`— ${pathOf(p.url)}`] : []), ...p.structure.blocks.map(blockLine)]);
  P.navigation = s.nav.present ? [
    `Пунктов в главном меню: ${s.nav.items}`,
    s.nav.dropdown && 'Есть выпадающие подменю',
    s.nav.anchors ? `Якорных ссылок на блоки страницы: ${s.nav.anchors}` : 'Меню ведёт на отдельные страницы',
    s.nav.burger ? 'Есть кнопка мобильного меню' : 'Кнопка мобильного меню в разметке не найдена',
    v.available && (v.stickyHeader ? 'Шапка закреплена при прокрутке' : 'Закреплённая шапка в стилях не найдена'),
    s.nav.cta && `Кнопка действия в шапке: «${s.nav.cta}»`, s.nav.phone && 'Телефон в шапке', s.nav.search && 'Поиск в шапке',
  ].filter(Boolean) : ['Навигация (nav/header) в разметке не найдена'];
  P.cards = s.cards.length ? s.cards.map(k => `${label(k.block)}: ${k.count} × ${k.kind} — ${k.parts.join(' + ') || 'текст'}`) : ['Повторяющиеся карточки не найдены'];
  const leadForms = list.flatMap(p => p.structure.forms.filter(f => !f.search).map(f => ({ ...f, page: pathOf(p.url) })));
  P.forms = leadForms.length ? leadForms.map(f => `${list.length > 1 ? f.page + ' · ' : ''}${label(f.block)}: поля — ${join(f.fields) || 'нет'}${f.required ? `; обязательных: ${f.required}` : ''}${f.submit ? `; кнопка «${f.submit}»` : ''}`) : ['Форм заявки в разметке не найдено'];
  const byLabel = new Map();
  for (const k of s.cta) { const key = k.label.toLowerCase(); const e = byLabel.get(key) || { label: k.label, n: 0, kinds: new Set(), blocks: new Set() }; e.n++; e.kinds.add(k.kind); e.blocks.add(label(k.block)); byLabel.set(key, e); }
  P.cta = byLabel.size ? [...byLabel.values()].sort((a, b) => b.n - a.n).slice(0, 8).map(e => `«${e.label}» × ${e.n} — ${[...e.kinds].join(', ')}; где: ${[...e.blocks].join(', ')}`) : ['Кнопки действия не найдены'];
  P.features = [...new Set(list.flatMap(p => p.structure.features))];
  if (!P.features.length) P.features = ['Интерактивные элементы в разметке не обнаружены'];

  if (v.available) {
    P.palette = v.palette.map(x => ({ hex: x.hex, role: x.role }));
    P.contrast = [
      v.contrast.textOnBackground ? `Основной текст на фоне: ${v.contrast.textOnBackground}:1 ${v.contrast.textOnBackground >= 7 ? '(AAA)' : v.contrast.textOnBackground >= 4.5 ? '(AA)' : '(ниже AA)'}` : 'Цвет текста или фона в стилях не определён',
      v.contrast.accentOnBackground ? `Акцент на фоне: ${v.contrast.accentOnBackground}:1` : '',
      v.mode ? `Тема: ${v.mode === 'dark' ? 'тёмная' : 'светлая'}${v.darkScheme ? ', есть поддержка prefers-color-scheme' : ''}` : '',
    ].filter(Boolean);
    P.typography = [
      v.headingFont && `Заголовки: ${v.headingFont.family} (${v.headingFont.kind})`,
      v.bodyFont && `Основной текст: ${v.bodyFont.family} (${v.bodyFont.kind})`,
      !v.headingFont && !v.bodyFont && v.fonts.length ? `Гарнитуры: ${v.fonts.map(f => `${f.family} (${f.kind})`).join('; ')}` : '',
      v.googleFonts.length ? `Google Fonts: ${v.googleFonts.join(', ')}` : '',
      v.heading.weight && `Насыщенность заголовков: ${v.heading.weight}`,
      v.heading.uppercase ? 'В заголовках используются прописные' : '', v.heading.tracking && `Трекинг заголовков: ${v.heading.tracking}`,
    ].filter(Boolean);
    if (!P.typography.length) P.typography = ['Гарнитуры в полученных стилях не определены'];
    P.headingSizes = ['h1', 'h2', 'h3', 'body'].filter(k => v.sizes[k]).map(k => `${k === 'body' ? 'Основной текст' : k}: ${v.sizes[k]}`);
    if (!P.headingSizes.length) P.headingSizes = ['Размеры заголовков в полученных стилях не заданы явно'];
    P.grid = [
      `display:grid — ${v.layout.grid}, display:flex — ${v.layout.flex}`,
      v.layout.columns.length ? `Колонки: ${v.layout.columns.join(' · ')}` : '',
      v.layout.containers.length ? `Ширина контейнера: ${v.layout.containers.map(x => x + 'px').join(', ')}` : '',
      v.layout.breakpoints.length ? `Контрольные точки: ${v.layout.breakpoints.map(x => x + 'px').join(', ')}${v.layout.approach ? ` (${v.layout.approach})` : ''}` : 'Медиа-запросы по ширине не найдены',
    ].filter(Boolean);
    P.spacing = [
      v.spacing.values.length ? `Частые отступы: ${v.spacing.values.map(x => x + 'px').join(', ')}` : 'Отступы в px/rem в стилях не найдены',
      v.spacing.unit ? `Шаг сетки отступов: ${v.spacing.unit}px` : v.spacing.values.length ? 'Единого шага отступов не прослеживается' : '',
      v.spacing.section.length ? `Вертикальные поля секций: ${v.spacing.section.map(x => x + 'px').join(', ')}` : '',
    ].filter(Boolean);
    P.radii = [
      v.radii.values.length ? `Скругления: ${v.radii.values.map(x => x + 'px').join(', ')}` : 'Скругления не используются',
      v.radii.pill ? `Капсулы и круги: ${v.radii.pill}` : '',
      `Характер формы: ${{ sharp: 'прямые углы', soft: 'малые скругления', round: 'крупные скругления и капсулы' }[v.radii.shape]}`,
      `Тени: ${v.effects.shadows}, градиенты: ${v.effects.gradients}${v.effects.backdrop ? ', размытие фона' : ''}`,
    ].filter(Boolean);
  }
  const hero = s.hero;
  P.composition = [
    hero ? `Первый экран: ${hero.video ? 'видео' : hero.bgImage ? 'фоновое изображение' : hero.images ? `изображение (${hero.images})` : 'без изображения'}${hero.form ? ', форма заявки' : ''}, кнопок: ${hero.cta}` : 'Первый экран не распознан',
    v.available ? `Центрированный текст: ${v.layout.center} ${plural(v.layout.center, 'правило', 'правила', 'правил')}` : '',
    v.available && (v.effects.transitions || v.effects.animations) ? `Движение: переходов ${v.effects.transitions}, анимаций ${v.effects.animations}${v.reducedMotion ? '; учитывается prefers-reduced-motion' : ''}` : '',
    `Блоков на странице: ${content.length}; с карточками: ${content.filter(b => b.cards).length}`,
  ].filter(Boolean);
  P.hierarchy = [
    `Заголовков h1 / h2 / h3: ${c.headings.levels.join(' / ')}`,
    v.available && v.sizes.h1 && v.sizes.body && toPx(v.sizes.h1) && toPx(v.sizes.body) ? `Отношение h1 к основному тексту: ×${Math.round(toPx(v.sizes.h1) / toPx(v.sizes.body) * 10) / 10}` : '',
    c.headings.avgWords ? `Средняя длина заголовка: ${c.headings.avgWords} слов` : '',
  ].filter(Boolean);

  P.userPath = [content.map(b => label(b.type)).join(' → ') || 'Путь не определён'];
  P.actions = [
    u.ctaInHeader ? `Действие в шапке: «${u.ctaInHeader}»` : 'В шапке нет кнопки действия',
    u.firstCtaIndex === 0 ? 'Первая кнопка — на первом экране' : u.firstCtaIndex > 0 ? `Первая кнопка появляется в блоке №${u.firstCtaIndex + 1}` : 'Кнопок действия в блоках не найдено',
    u.ctaAtEnd ? 'Страница заканчивается призывом к действию' : 'В последнем блоке нет призыва к действию',
    u.contacts.length ? `Способы связи: ${u.contacts.join(', ')}` : 'Способы связи в разметке не найдены',
  ];
  P.navUx = [
    s.nav.present ? (s.nav.items <= 7 ? `Меню компактное: ${s.nav.items} ${plural(s.nav.items, 'пункт', 'пункта', 'пунктов')}` : `Меню перегружено: ${s.nav.items} пунктов`) : 'Меню не найдено',
    s.nav.anchors ? 'Одностраничная навигация по якорям' : '', P.features.includes('хлебные крошки') ? 'Есть хлебные крошки' : '', P.features.includes('поиск по сайту') ? 'Есть поиск' : '',
  ].filter(Boolean);
  P.mobile = [
    u.viewport ? 'Meta viewport задан' : 'Meta viewport не задан',
    v.available ? (v.layout.mediaQueries ? `Медиа-запросов: ${v.layout.mediaQueries}${v.layout.approach ? `, подход ${v.layout.approach}` : ''}` : 'Медиа-запросы не найдены') : 'Адаптивные стили не проверены (CSS не получен)',
    s.nav.burger ? 'Мобильное меню: отдельная кнопка' : 'Отдельной кнопки мобильного меню нет',
    main.stats.images ? `Адаптивных изображений (srcset/picture): ${u.responsiveImages} из ${main.stats.images}; ленивая загрузка: ${u.lazyImages}` : '',
    P.features.includes('кликабельный телефон') ? 'Телефон можно набрать касанием' : '',
  ].filter(Boolean);
  P.issues = u.issues.length ? u.issues.map(x => x[0].toUpperCase() + x.slice(1)) : ['Автоматические проверки проблем не нашли (это не заменяет ручной просмотр)'];

  const typeEntries = Object.entries(c.headings.types).sort((a, b) => b[1] - a[1]);
  P.headingTypes = typeEntries.length ? typeEntries.map(([t, n]) => `${t[0].toUpperCase() + t.slice(1)}: ${n}`) : ['Заголовки не найдены'];
  const adv = content.find(b => b.type === 'advantages') || content.find(b => b.type === 'stats');
  P.benefits = adv ? [`Отдельный блок «${label(adv.type)}»${adv.cards ? `: ${adv.cards.count} × ${adv.cards.kind} (${adv.cards.parts.join(' + ')})` : adv.lists ? ': списком' : ': текстом'}`, `Позиция в сценарии: блок №${content.indexOf(adv) + 1} из ${content.length}`]
    : ['Отдельного блока преимуществ нет — аргументы распределены по другим блокам или отсутствуют'];
  P.offer = hero ? [
    `Заголовок первого экрана: ${c.heroWords} ${plural(c.heroWords, 'слово', 'слова', 'слов')}, тип — ${headingType(hero.heading)}`,
    c.heroHasLead ? 'Есть поясняющий абзац под заголовком' : 'Поясняющего абзаца под заголовком нет',
    `Кнопок на первом экране: ${hero.cta}`, c.proof ? 'Есть доказательства рядом с предложением (цифры или рейтинг)' : 'Доказательств рядом с предложением нет',
  ] : ['Первый экран не распознан — структура предложения не определена'];
  P.cardTypes = s.cards.length ? [...new Set(s.cards.map(k => `${k.kind}: ${k.parts.join(' + ') || 'текст'}`))] : ['Карточки не найдены'];
  P.ctaLogic = c.primaryCta ? [
    `Главное действие: «${c.primaryCta.label}», повторов: ${c.primaryCta.repeats}`,
    `Разных формулировок CTA: ${c.ctaLabels}`,
    `Куда ведут: ${[...new Set(s.cta.map(k => k.kind))].join(', ')}`,
  ] : ['Кнопки действия не найдены'];

  // Идеи — не измерение, а черновик от студии: что из найденного стоит переосмыслить в собственном дизайне.
  const ideas = [];
  if (c.primaryCta && c.primaryCta.repeats >= 3) ideas.push('Взять принцип одного повторяющегося действия, но изменить формулировку и композицию первого экрана');
  if (s.cards.some(k => k.parts.includes('цена'))) ideas.push('Сохранить логику карточки «изображение — название — цена — действие», но с собственной сеткой и пропорциями');
  if (s.order.includes('process')) ideas.push('Показать этапы работы в другом формате: шкала, главы или один интерактивный модуль вместо ряда карточек');
  if (s.order.includes('reviews')) ideas.push('Доказательства доверия разместить ближе к предложению, а не отдельной лентой внизу');
  if (u.issues.length) ideas.push(`Не повторять слабые места источника: ${u.issues.slice(0, 2).join('; ')}`);
  ideas.push('Палитру, шрифты, тексты и изображения источника не переносить — подобрать свои под нишу и аудиторию проекта');
  P.ideas = ideas;

  const sectionOrder = [];
  for (const t of s.order) { const id = BLOCK_TO_SECTION[t]; if (id && !sectionOrder.includes(id)) sectionOrder.push(id); }
  const traits = {
    archetypes: guessArchetypes(main), sectionOrder,
    nav: !s.nav.present ? '' : s.nav.items <= 3 ? 'minimal' : P.features.includes('корзина') || P.features.includes('фильтры и сортировка') ? 'category' : 'bar',
    shape: v.available ? v.radii.shape : '', mode: v.available ? v.mode : '', typeCharacter: typeCharacter(v),
    heroVisual: hero ? (hero.video ? 'video' : hero.bgImage ? 'background' : hero.images ? 'image' : 'none') : '',
    heroForm: Boolean(hero && hero.form), blocks: content.length,
  };
  return { profile: P, traits, warnings: [...new Set(list.flatMap(p => p.warnings))] };
}

/** Список таблиц стилей страницы (для загрузки через анализатор-сервер). */
export function stylesheetLinks(html, url) {
  const root = parseHtml(html);
  const out = [];
  for (const n of findAll(root, n => n.tag === 'link' && /stylesheet/i.test(n.attrs.rel || '') && n.attrs.href)) {
    try { const u = new URL(n.attrs.href, url).href; if (/^https?:/i.test(u) && !FONT_HOST.test(u) && !out.includes(u)) out.push(u); } catch { /* некорректная ссылка */ }
  }
  return out;
}

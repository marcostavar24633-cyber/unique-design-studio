// Проверка раскладки в настоящем браузере: то, что не видно по HTML и CSS по отдельности.
// Функция layoutQA выполняется внутри страницы (Playwright page.evaluate или iframe предпросмотра студии)
// и возвращает замечания:
// - covered — текст перекрыт другим элементом (наложение блоков, липкая шапка, картинка поверх);
// - offscreen — текст выходит за правый или левый край экрана;
// - clipped — текст обрезан контейнером с overflow:hidden;
// - contrast — контраст текста на фактическом сплошном фоне ниже WCAG AA.
// Декоративное (aria-hidden), визуально скрытое (.vh) и текст на фото/градиенте в контраст не проверяются:
// для фото контраст обеспечивают вуаль и аудит палитры.

export function layoutQA(opts = {}) {
  const limit = opts.limit || 40;
  const out = [];
  const vw = document.documentElement.clientWidth;
  const add = (kind, el, detail) => { if (out.length < limit) out.push({ kind, el: label(el), text: (el.textContent || '').trim().slice(0, 50), detail }); };
  function label(el) {
    if (!el || !el.tagName) return String(el);
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
  }
  function shown(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  const hasOwnText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
  const texts = [...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,summary,label,small,span,strong,b,em,dt,dd,figcaption,td,th')]
    .filter(hasOwnText)
    .filter(el => !el.closest('[aria-hidden="true"], .vh, .skip, script, style, noscript'))
    .filter(shown);

  // --- цвет и контраст ---
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  function background(el) {
    // Сплошной фон под текстом. Сначала смотрим, что фактически лежит под текстом (не только предки):
    // фото, рисунок или градиент под ним — контраст оценить нельзя («неизвестно»).
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // Текст за краем экрана (например, в прокручиваемом меню): фон под ним не виден — оценить нельзя.
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return null;
    {
      for (const n of document.elementsFromPoint(cx, cy)) {
        if (n === el || el.contains(n)) continue;
        if (/^(IMG|PICTURE|VIDEO|CANVAS|svg)$/i.test(n.tagName) || n.closest('svg')) return null;
        const ncs = getComputedStyle(n);
        if (ncs.backgroundImage && ncs.backgroundImage !== 'none') return null;
        const c = parse(ncs.backgroundColor);
        if (c && c.a >= 0.99) break;
      }
    }
    let color = null;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      if (n.classList?.contains('has-photo-bg') || n.querySelector?.(':scope > .hero__bg, :scope > .hero__photo-bg')) return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { color = color ? blend(color, c) : c; if (color.a >= 0.99 || c.a >= 0.99) return { ...color, a: 1 }; }
    }
    return color ? blend(color, { r: 255, g: 255, b: 255, a: 1 }) : { r: 255, g: 255, b: 255, a: 1 };
  }

  for (const el of texts) {
    const r = el.getBoundingClientRect();
    // Вне экрана по горизонтали (кроме содержимого горизонтальной ленты с прокруткой).
    // Внутри горизонтально прокручиваемого контейнера (лента карточек, меню на телефоне) выход за экран — норма.
    let inScroller = null;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(n).overflowX) && n.scrollWidth > n.clientWidth) { inScroller = n; break; }
    }
    if (!inScroller && (r.right > vw + 1 || r.left < -1)) add('offscreen', el, `${Math.round(r.left)}…${Math.round(r.right)} при ширине ${vw}`);

    // Обрезан контейнером.
    const cs = getComputedStyle(el);
    if (/hidden|clip/.test(cs.overflowX + cs.overflow) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis') add('clipped', el, `${el.scrollWidth}px в ${el.clientWidth}px`);

    // Перекрыт: прокручиваем к элементу и смотрим, что сверху в нескольких точках.
    if (!inScroller) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
      const b = el.getBoundingClientRect();
      const pts = [[b.left + b.width / 2, b.top + b.height / 2], [b.left + Math.min(8, b.width / 4), b.top + b.height / 2], [b.right - Math.min(8, b.width / 4), b.top + b.height / 2]];
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const top = document.elementFromPoint(x, y);
        if (!top || top === el || el.contains(top) || top.contains(el)) continue;
        // Соседний текст той же строки (inline) — не перекрытие.
        if (el.parentElement && el.parentElement.contains(top) && getComputedStyle(top).position === 'static') continue;
        add('covered', el, 'сверху ' + label(top));
        break;
      }
    }

    // Контраст на сплошном фоне.
    const fg = parse(cs.color), bg = background(el);
    if (fg && bg && fg.a > 0.5) {
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
      const k = ratio(blend(fg, bg), bg);
      if (k < need - 0.05) add('contrast', el, `${k.toFixed(2)}:1, нужно ${need}:1`);
    }
  }
  window.scrollTo(0, 0);
  return out;
}

/** Исходник функции для запуска внутри страницы: `(${LAYOUT_QA_SOURCE})(opts)`. */
export const LAYOUT_QA_SOURCE = layoutQA.toString();

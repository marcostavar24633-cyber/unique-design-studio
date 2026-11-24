// Общие утилиты движка. Без зависимостей: работает и в Node, и в браузере.

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Детерминированный генератор случайных чисел (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Отдельный поток случайности на каждое решение: смена одного выбора не сдвигает остальные. */
export const stream = (seed, name) => rng(hash(`${seed}:${name}`));

export function pick(r, arr, avoid = []) {
  const pool = arr.filter(x => !avoid.includes(x));
  const src = pool.length ? pool : arr;
  return src[Math.floor(r() * src.length)];
}

export const between = (r, [a, b]) => a + (b - a) * r();

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

/** Разрешает только безопасные схемы ссылок; иначе возвращает пустую строку. */
export function safeUrl(value, { image = false } = {}) {
  const u = String(value ?? '').trim();
  const maxLength = image && /^data:image\//i.test(u) ? 5_000_000 : 4_096;
  if (u.length > maxLength) return '';
  if (!u || /[\u0000-\u001f\u007f]/.test(u)) return '';
  if (/^https?:\/\//i.test(u)) {
    try {
      const parsed = new URL(u);
      if (!parsed.hostname || parsed.username || parsed.password) return '';
      return u;
    } catch { return ''; }
  }
  if (/^(\/(?!\/)|\.\.?\/|#)/i.test(u)) return u;
  if (!image && /^mailto:/i.test(u)) return /^mailto:[^\s@?]+@[^\s@?]+(?:\.[^\s@?]+)+(?:\?[^\s]*)?$/i.test(u) ? u : '';
  if (!image && /^tel:/i.test(u)) return /^tel:\+?[\d().\s-]{5,}$/i.test(u) && u.replace(/\D/g, '').length >= 5 ? u : '';
  if (image && /^data:image\/(png|jpe?g|webp|gif|avif|svg\+xml)[;,]/i.test(u)) return u;
  if (/^[\w\-./%]+\.(png|jpe?g|webp|gif|avif|svg|html?)$/i.test(u)) return u;
  return '';
}

const TRANSLIT = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
export function slugify(value) {
  return String(value ?? '').toLowerCase().replace(/[а-яё]/g, c => TRANSLIT[c] ?? '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'project';
}

export const str = v => (typeof v === 'string' ? v.normalize('NFC').trim() : typeof v === 'number' ? String(v) : '');
export const uniq = arr => [...new Set(arr)];

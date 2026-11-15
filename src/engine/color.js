// Цвет: HSL ↔ HEX, контраст WCAG и подбор читаемых пар.

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export function normalizeHex(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!m) return '';
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return '#' + h.toLowerCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s * 100, l * 100];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Сдвигает светлоту fg прочь от bg, пока контраст не достигнет min. */
export function ensureContrast(fg, bg, min) {
  if (contrast(fg, bg) >= min) return fg;
  const [h, s, l] = hexToHsl(fg);
  const dir = luminance(bg) > 0.4 ? -1 : 1;
  for (let step = 1; step <= 100; step++) {
    const nl = l + dir * step;
    if (nl < 0 || nl > 100) break;
    const c = hslToHex(h, s, nl);
    if (contrast(c, bg) >= min) return c;
  }
  return dir < 0 ? '#000000' : '#ffffff';
}

/** Чёрный или белый текст — тот, что контрастнее на данном фоне. */
export const readableOn = (bg, dark = '#111111', light = '#ffffff') =>
  contrast(light, bg) >= contrast(dark, bg) ? light : dark;

export const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(', ')}, ${a})`;

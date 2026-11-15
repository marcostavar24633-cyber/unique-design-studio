// Абстрактные графические мотивы (inline SVG) — заполняют место визуала, пока нет фотографий.
// Это декоративная графика (aria-hidden), а не имитация фотографии товара или работ.
import { stream } from './util.js';
import { mix } from './color.js';

const n = v => Math.round(v * 10) / 10;

const DRAW = {
  arcs(r, c) {
    const cx = 800 * (r() > 0.5 ? 1 : 0), cy = 600 * (r() > 0.5 ? 1 : 0);
    let out = '';
    for (let i = 7; i >= 1; i--) out += `<circle cx="${cx}" cy="${cy}" r="${i * 95}" fill="${i % 2 ? c.a : c.b}" opacity="${n(0.25 + i * 0.09)}"/>`;
    return out + `<circle cx="${n(180 + r() * 440)}" cy="${n(140 + r() * 320)}" r="${n(40 + r() * 50)}" fill="${c.accent}"/>`;
  },
  dots(r, c) {
    let out = '';
    const step = 50 + Math.floor(r() * 3) * 10;
    for (let y = step / 2; y < 600; y += step) for (let x = step / 2; x < 800; x += step) {
      const d = Math.hypot(x - 520, y - 260) / 520;
      out += `<circle cx="${x}" cy="${y}" r="${n(Math.max(1.5, (1 - d) * step * 0.34))}" fill="${r() > 0.93 ? c.accent : c.b}"/>`;
    }
    return out;
  },
  orbits(r, c) {
    let out = '';
    for (let i = 1; i <= 5; i++) out += `<ellipse cx="400" cy="300" rx="${i * 85}" ry="${i * 38}" fill="none" stroke="${c.b}" stroke-width="2" transform="rotate(${n(-24 + r() * 8)} 400 300)"/>`;
    for (let i = 0; i < 26; i++) out += `<circle cx="${n(r() * 800)}" cy="${n(r() * 600)}" r="${n(1 + r() * 2.6)}" fill="${c.b}"/>`;
    return out + `<circle cx="400" cy="300" r="46" fill="${c.accent}"/><circle cx="${n(560 + r() * 120)}" cy="${n(170 + r() * 60)}" r="13" fill="${c.a}"/>`;
  },
  bands(r, c) {
    let out = '';
    const w = 70 + r() * 50;
    for (let i = -6; i < 16; i++) out += `<rect x="${n(i * w)}" y="-300" width="${n(w * 0.52)}" height="1300" fill="${i % 4 === 0 ? c.accent : i % 2 ? c.a : c.b}" transform="rotate(28 400 300)"/>`;
    return out;
  },
  blobs(r, c) {
    let out = '';
    const fills = [c.a, c.b, c.accent, c.a, c.b];
    for (let i = 0; i < 5; i++) out += `<ellipse cx="${n(120 + r() * 560)}" cy="${n(100 + r() * 400)}" rx="${n(110 + r() * 150)}" ry="${n(80 + r() * 120)}" fill="${fills[i]}" opacity="${n(0.55 + r() * 0.4)}" transform="rotate(${n(r() * 90)} 400 300)"/>`;
    return out;
  },
  blocks(r, c) {
    let out = '', x = 0;
    while (x < 800) {
      const w = 110 + Math.floor(r() * 4) * 55; let y = 0;
      while (y < 600) {
        const h = 90 + Math.floor(r() * 4) * 60, k = r();
        out += `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="${k > 0.86 ? c.accent : k > 0.45 ? c.a : c.b}"/>`;
        y += h;
      }
      x += w;
    }
    return out;
  },
  horizon(r, c) {
    let out = `<circle cx="${n(250 + r() * 300)}" cy="${n(210 + r() * 60)}" r="${n(80 + r() * 50)}" fill="${c.accent}"/>`;
    for (let i = 0; i < 5; i++) {
      const y = 300 + i * 62, a = 18 + r() * 34, o = r() * 200;
      out += `<path d="M0 ${y} C ${n(200 + o)} ${n(y - a)}, ${n(400 + o)} ${n(y + a)}, 800 ${n(y - a / 2)} L800 600 L0 600Z" fill="${i % 2 ? c.a : c.b}" opacity="${n(0.6 + i * 0.1)}"/>`;
    }
    return out;
  },
  waves(r, c) {
    let out = '';
    for (let i = 0; i < 9; i++) {
      const y = 40 + i * 66, a = 20 + r() * 26;
      out += `<path d="M-20 ${y} Q 90 ${n(y - a)} 200 ${y} T 420 ${y} T 640 ${y} T 860 ${y}" fill="none" stroke="${i % 3 === 1 ? c.accent : i % 2 ? c.a : c.b}" stroke-width="${n(10 + r() * 16)}" stroke-linecap="round"/>`;
    }
    return out;
  },
};

export const MOTIFS = Object.keys(DRAW);

/** Возвращает <svg> с мотивом, раскрашенным палитрой проекта. variant меняет рисунок внутри одного проекта. */
export function motifSvg(visualSystem, variant = 0) {
  const p = visualSystem.palette;
  const r = stream(visualSystem.seed, `motif:${variant}`);
  const base = p.mode === 'dark' ? mix(p.bg, '#ffffff', 0.06) : mix(p.bg, p.accent, 0.08);
  const colors = { a: mix(base, p.accent, 0.3), b: mix(base, p.text, p.mode === 'dark' ? 0.3 : 0.16), accent: p.accent };
  const kind = MOTIFS.includes(visualSystem.motif) ? visualSystem.motif : 'blocks';
  const draw = DRAW[variant ? MOTIFS[(MOTIFS.indexOf(kind) + variant * 3) % MOTIFS.length] : kind];
  return `<svg class="ds-media motif" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="800" height="600" fill="${base}"/>${draw(r, colors)}</svg>`;
}

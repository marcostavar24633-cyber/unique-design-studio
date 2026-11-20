import { createRequire } from 'node:module';
import { generate, CARD_EFFECT_IDS, HERO_EFFECT_IDS } from '../../src/engine/index.js';
import { LAYOUT_QA_SOURCE } from '../../src/engine/layout-qa.js';
const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch();
const photo = (w, h, hue) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="hsl(${hue} 40% 45%)"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="hsl(${hue} 50% 70%)"/></svg>`);
const base = { brand: 'Поток', niche: 'студия йоги', title: 'Йога для спины и спокойной головы', description: 'Малые группы и внимательный тренер. Занятия утром и вечером.', cta: 'Записаться на пробное', contacts: { email: 'hello@example.com' },
  images: { hero: photo(1600, 900, 160), heroAlt: 'Зал' }, gallery: [0, 1, 2].map(i => ({ src: photo(800, 1000, 30 + i * 60), alt: 'Кадр' })),
  services: [['Хатха', 'Спокойная практика для начинающих', '900 ₽', photo(800, 600, 20), 'Хатха', '', 'Хит'], ['Виньяса', 'Динамичные связки под дыхание', '1000 ₽', photo(800, 600, 90)], ['Йога для спины', 'Мягкая работа с осанкой', '1100 ₽', photo(800, 600, 200)]],
  advantages: [['12 лет практики', 'Опытные тренеры'], ['8 человек в группе', 'Внимание каждому'], ['300 учеников', 'Возвращаются снова']] };
const issues = [];
const cases = [...HERO_EFFECT_IDS.map(h => ({ heroEffect: h, cardEffect: 'none' })), ...CARD_EFFECT_IDS.map(c => ({ cardEffect: c, heroEffect: 'none' }))];
let n = 0;
for (const [i, fx] of cases.entries()) for (const palette of ['light', 'dark']) {
  const arch = ['split-utility', 'immersive', 'editorial', 'product-first', 'asymmetric'][i % 5];
  const r = generate({ ...base, id: `fx-${i}-${palette}`, palette, architecture: arch, ...fx });
  for (const w of [1280, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 820 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.setContent(r.html, { waitUntil: 'load' });
    await p.evaluate(() => document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in')));
    await p.mouse.move(w / 2, 300); await p.waitForTimeout(2800);
    const res = await p.evaluate(`(${LAYOUT_QA_SOURCE})({ limit: 6 })`);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const name = `${fx.heroEffect !== 'none' ? 'hero:' + fx.heroEffect : 'card:' + fx.cardEffect}/${palette}/${arch}@${w}`;
    for (const f of res) issues.push(`${name}: ${f.kind} — ${f.el} «${String(f.text).slice(0, 40)}» (${f.detail})`);
    if (ov > 0) issues.push(`${name}: горизонтальная прокрутка ${ov}px`);
    for (const e of errs) issues.push(`${name}: ошибка скрипта ${e}`);
    n++; await p.close();
  }
}
await b.close();
console.log(`проверено страниц: ${n}, замечаний: ${issues.length}`);
console.log(issues.slice(0, 60).join('\n'));

// AI Image Director PRO: задания по местам для изображений и проверка набора фото.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { qualityReport } from '../src/engine/quality.js';
import { HERO_WITHOUT_PHOTO, imageSlots, imageTaskPackage, reviewImageSet, slotBrief } from '../src/engine/image-director.js';

const site = (input, arch) => {
  const p = { ...autopilot({ email: 'hello@example.com', ...input }, { registry: [] }).project };
  if (arch) Object.assign(p, { designArchitecture: arch, architecture: arch, architectureMode: 'manual' });
  return generate(p);
};

test('задания есть и до загрузки фото: по одному на каждое место на странице', () => {
  const g = site({ niche: 'магазин мебели' }, 'product-first');
  const { slots, filled, total } = imageSlots(g.project, g.concept);
  assert.equal(filled, 0);
  assert.equal(total, slots.length);
  assert.ok(slots.some(s => s.id === 'hero'));
  assert.equal(slots.filter(s => s.role === 'service').length, g.project.services.filter(i => i.title).length, 'по заданию на каждую позицию');
  assert.ok(slots.filter(s => s.role === 'gallery').length >= 4);
  for (const s of slots) for (const key of ['subject', 'angle', 'light', 'background', 'composition', 'aspect', 'mobileAspect']) assert.ok(s[key], `${s.id}.${key}`);
});

test('пропорции соответствуют раскладке: карточки 4:3, галерея 4:5, полноэкранный первый экран 16:9', () => {
  const g = site({ niche: 'фотограф' }, 'immersive');
  const slots = imageSlots(g.project, g.concept).slots;
  assert.equal(slots.find(s => s.id === 'hero').aspect, '16:9');
  assert.ok(slots.filter(s => s.role === 'gallery').every(s => s.aspect === '4:5'));
  const shop = imageSlots(site({ niche: 'магазин мебели' }, 'catalog').project, site({ niche: 'магазин мебели' }, 'catalog').concept).slots;
  assert.ok(shop.filter(s => s.role === 'service').every(s => s.aspect === '4:3'));
});

test('свет следует за палитрой и классом', () => {
  const lux = site({ niche: 'ювелирный магазин', tier: 'luxury' });
  assert.match(imageSlots(lux.project, lux.concept).slots[0].light, /направленный свет/);
  const dark = site({ niche: 'фотограф' }, 'immersive');
  const darkBg = dark.concept.visualSystem.palette.bg;
  const light = imageSlots(dark.project, dark.concept).slots[0].light;
  if (/^#[0-3]/.test(darkBg)) assert.match(light, /низкий ключ/);
});

test('архитектуры без фото на первом экране не требуют его, а загруженное фото — повод для замечания', () => {
  for (const arch of HERO_WITHOUT_PHOTO) {
    const g = site({ niche: 'кофейня' }, arch);
    assert.ok(!imageSlots(g.project, g.concept).slots.some(s => s.id === 'hero'), arch);
    assert.ok(!reviewImageSet(g.project, g.concept).findings.some(f => f.id === 'images:hero-missing'), arch);
    const withHero = generate({ ...g.project, images: { hero: 'https://example.com/a.jpg' } });
    if (withHero.concept.visualSystem.archetype === arch) assert.ok(reviewImageSet(withHero.project, withHero.concept).findings.some(f => f.id === 'images:hero-unused'), arch);
  }
});

test('проверка набора: ALT, повторы, частично заполненные карточки, http и мобильная версия', () => {
  const g = site({ niche: 'магазин мебели' }, 'immersive');
  const p = {
    ...g.project,
    images: { hero: 'https://example.com/hero.jpg', heroAlt: '' },
    gallery: [{ src: 'https://example.com/a.jpg', alt: 'IMG_2041.jpg' }, { src: 'http://example.com/b.jpg', alt: 'Кухня' }, { src: 'https://example.com/hero.jpg', alt: 'Кухня' }],
    services: g.project.services.map((s, i) => (i === 0 ? { ...s, image: 'https://example.com/s.jpg' } : s)),
  };
  const r = generate(p);
  const ids = reviewImageSet(r.project, r.concept).findings.map(f => f.id);
  for (const id of ['images:alt-missing', 'images:alt-filename', 'images:alt-duplicate', 'images:src-duplicate', 'images:insecure', 'images:items-partial', 'images:hero-mobile']) assert.ok(ids.includes(id), id);
});

test('замечания Image Director попадают в контроль качества без дублей', () => {
  const g = site({ niche: 'фотограф' }, 'immersive');
  const q = qualityReport(g);
  assert.ok(q.findings.some(f => f.id === 'images:hero-missing'));
  assert.ok(!q.findings.some(f => f.id === 'director:hero-visual'), 'то же замечание Design Director не повторяется');
});

test('задание честно говорит, что изображения не генерируются, и содержит запреты', () => {
  const g = site({ niche: 'кофейня' });
  const text = imageTaskPackage(g.project, g.concept);
  assert.match(text, /Студия не генерирует изображения/);
  const brief = slotBrief(imageSlots(g.project, g.concept).slots[0], g.project);
  assert.match(brief, /Без надписей, логотипов, водяных знаков/);
  assert.match(brief, /Без выдуманных деталей товара, наград и сертификатов/);
  assert.doesNotMatch(text, /\.;|;\s*\./);
});

test('студия показывает задания и без загруженных фото', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(js, /Фотографии пока не добавлены[^']*' \+ renderImageTasks\(\); return;/);
  assert.match(js, /\$\{renderImageTasks\(\)\}/);
  assert.match(js, /data-image-tasks="download"/);
  assert.match(js, /esc\(slotBrief\(slot, result\.project\)\)/);
});

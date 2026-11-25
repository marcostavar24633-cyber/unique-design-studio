// AI Image Director PRO: задания по местам для изображений и проверка набора фото.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { qualityReport } from '../src/engine/quality.js';
import { HERO_AS_BACKGROUND, imageSlots, imageTaskPackage, reviewImageSet, slotBrief } from '../src/engine/image-director.js';

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
  const galleryTitles = slots.filter(s => s.role === 'gallery').slice(0, 8).map(s => s.label);
  assert.equal(new Set(galleryTitles).size, 8, 'у кадров свои осмысленные названия');
  assert.ok(galleryTitles.every(title => !/галерея|кадр\s*\d/i.test(title)), 'не используются заглушки «Галерея, кадр N»');
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

test('текстовые архитектуры: фото первого экрана становится фоном под вуалью, а не пропадает', () => {
  for (const arch of HERO_AS_BACKGROUND) {
    const g = site({ niche: 'кофейня' }, arch);
    if (g.concept.visualSystem.archetype !== arch) continue;
    const hero = imageSlots(g.project, g.concept).slots.find(s => s.id === 'hero');
    assert.ok(hero?.asBackground, `${arch}: есть место «Фон первого экрана»`);
    assert.equal(hero.aspect, '16:9');
    assert.equal(reviewImageSet(g.project, g.concept).findings.find(f => f.id === 'images:hero-missing')?.severity, 'medium', arch);
    const withHero = generate({ ...g.project, images: { hero: 'https://example.com/a.jpg' } });
    assert.match(withHero.html, /class="hero hero--[a-z-]+ is-[a-z-]+ has-photo-bg"/, arch);
    assert.match(withHero.html, /<div class="hero__photo-bg" aria-hidden="true"><img [^>]*alt="" data-decorative="hero-bg"/, arch);
    assert.match(withHero.html, /\.hero__photo-bg::after\{content:"";position:absolute;inset:0;background:var\(--ds-bg\);opacity:\.9\}/, 'вуаль цвета фона');
    assert.ok(withHero.audit.ok, withHero.audit.errors.map(e => e.message).join('; '));
    assert.ok(!withHero.audit.warnings.some(w => w.id === 'img-alt-empty'), 'декоративный фон не считается фото без описания');
    assert.ok(!reviewImageSet(withHero.project, withHero.concept).findings.some(f => f.id === 'images:hero-mobile'), 'фон обрезается сам, мобильная версия не обязательна');
  }
});

test('архитектуры с отдельной картинкой первого экрана не получают фон-дубль', () => {
  const g = generate({ ...site({ niche: 'фотограф' }, 'immersive').project, images: { hero: 'https://example.com/a.jpg' } });
  assert.doesNotMatch(g.html, /hero__photo-bg/);
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

test('галерея планирует 8 кадров с разными сюжетами', async () => {
  const { GALLERY_FRAMES } = await import('../src/engine/image-director.js');
  const { generate } = await import('../src/engine/index.js');
  const g = generate({ niche: 'гончарная мастерская', brand: 'Глина', services: [['Мастер-класс', '']] });
  const gallery = imageSlots(g.project, g.concept).slots.filter(slot => slot.role === 'gallery');
  assert.equal(GALLERY_FRAMES, 8);
  assert.equal(gallery.length, 8);
  assert.equal(new Set(gallery.map(slot => slot.subject)).size, 8, 'сюжеты кадров повторяются');
});

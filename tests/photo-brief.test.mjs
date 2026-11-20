// Английский бриф для генератора фото: ниша → кухня и обстановка, позиция → точное блюдо или товар.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generate } from '../src/engine/index.js';
import { autopilot } from '../src/engine/autopilot.js';
import { imageSlots } from '../src/engine/image-director.js';
import { itemSubject, nicheVisual, photoPrompt, translit } from '../src/engine/photo-brief.js';

const site = (niche, services, extra = {}) => {
  const p = { ...autopilot({ niche, email: 'a@b.ru', ...extra }, { registry: [] }).project };
  if (services) p.services = services.map(t => [t, '']);
  const g = generate(p);
  return { g, slots: imageSlots(g.project, g.concept).slots };
};

test('вьетнамское кафе: блюда в карточках — фо, нем, бан ми, вьетнамский кофе, а не интерьер', () => {
  const { g, slots } = site('кафе вьетнамская кухня', ['Фо Бо', 'Нем', 'Бан Ми', 'Кофе'], { city: 'Ульяновск', tier: 'luxury' });
  const items = slots.filter(s => s.role === 'service').map(s => photoPrompt(s, g.project));
  assert.match(items[0], /pho bo: a large deep bowl of Vietnamese beef noodle soup/);
  assert.match(items[1], /nem ran: crispy golden Vietnamese fried spring rolls/);
  assert.match(items[2], /banh mi: a crispy Vietnamese baguette sandwich/);
  assert.match(items[3], /phin drip filter/);
  for (const p of items) {
    assert.match(p, /Vietnamese cafe/);
    assert.match(p, /Avoid: not a European bistro/);
    assert.match(p, /close-up from 45 degrees/, 'блюдо крупно, а не общий план зала');
  }
});

test('первый экран и галерея показывают обстановку и блюда своей кухни', () => {
  const { g, slots } = site('кафе вьетнамская кухня', ['Фо Бо', 'Нем']);
  const all = slots.map(s => photoPrompt(s, g.project));
  for (const p of all) assert.match(p, /Vietnamese/, p.slice(0, 80));
  const hero = slots.find(s => s.id === 'hero');
  if (hero) assert.match(photoPrompt(hero, g.project), /authentic Vietnamese dishes, pho bo in the center/);
});

test('кухня определяется и по названиям блюд, если в нише её нет', () => {
  const v = nicheVisual({ niche: 'кафе', services: [['Рамен', ''], ['Суши сет', '']] });
  assert.equal(v.cuisine.id, 'japanese');
  assert.match(itemSubject('Рамен', v), /ramen/);
});

test('незнакомое блюдо: транслит и контекст кухни, без кириллицы', () => {
  const v = nicheVisual({ niche: 'вьетнамская кухня', services: [] });
  const s = itemSubject('Каштановый пирог', v);
  assert.match(s, /authentic Vietnamese dish called "Kashtanovyy pirog"/);
});

test('ниши вне кухни получают свою сцену', () => {
  assert.match(nicheVisual({ niche: 'раковарня', services: [] }).hero, /crayfish/);
  assert.match(nicheVisual({ niche: 'стоматология', services: [] }).en, /dental clinic/);
  assert.match(nicheVisual({ niche: 'автосервис', services: [] }).en, /car service/);
  assert.match(nicheVisual({ niche: 'гончарная мастерская', services: [] }).en, /Goncharnaya masterskaya/i, 'незнакомая ниша — транслит');
});

test('ни один промпт не содержит кириллицы: FLUX её не понимает и может нарисовать буквы', () => {
  const idx = JSON.parse(readFileSync(new URL('../examples/index.json', import.meta.url), 'utf8'));
  const projects = idx.map(e => JSON.parse(readFileSync(new URL('../examples/' + e.file, import.meta.url), 'utf8')));
  for (const n of ['кафе вьетнамская кухня', 'суши-бар', 'грузинский ресторан', 'кофейня', 'магазин мебели', 'стоматология', 'фотограф', 'школа гончарного дела'])
    projects.push(autopilot({ niche: n, email: 'a@b.ru' }, { registry: [] }).project);
  for (const raw of projects) {
    const g = generate(raw);
    for (const slot of imageSlots(g.project, g.concept).slots) {
      const p = photoPrompt(slot, g.project);
      assert.doesNotMatch(p, /[а-яё]/i, `${g.project.niche} / ${slot.id}: ${p.slice(0, 120)}`);
      assert.match(p, /No text, no letters, no logos/);
      assert.ok(p.length < 2000, 'промпт помещается в лимит Worker');
    }
  }
});

test('транслитерация сохраняет регистр и убирает кавычки', () => {
  assert.equal(translit('«Щука» Ёж'), 'Shchuka Yozh');
});

test('студия отправляет генератору английский бриф, а ALT фото — для посетителей, не текст задания', () => {
  const js = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.match(js, /const prompt = photoPrompt\(slot, photoProject, result\.concept\.visualSystem\.graphicDirection\)/);
  assert.match(js, /const photoProject = visualHints \? \{ \.\.\.result\.project, visualHints \} : result\.project;/);
  assert.doesNotMatch(js, /'Business niche: ' \+/);
  assert.doesNotMatch(js, /heroAlt: slot\.subject|alt: slot\.subject|row\[4\] = slot\.subject/);
  assert.match(js, /function generatedAlt\(slot, project\)/);
});

test('фон первого экрана в текстовых архитектурах — спокойная атмосфера, а не блюдо в центре', async () => {
  const { autopilot: ap } = await import('../src/engine/autopilot.js');
  const p = { ...ap({ niche: 'кафе вьетнамская кухня', email: 'a@b.ru' }, { registry: [] }).project, designArchitecture: 'minimal', architecture: 'minimal', architectureMode: 'manual' };
  const g = generate(p);
  const hero = imageSlots(g.project, g.concept).slots.find(s => s.id === 'hero');
  if (g.concept.visualSystem.archetype !== 'minimal') return;
  assert.ok(hero.asBackground);
  const prompt = photoPrompt(hero, g.project);
  assert.match(prompt, /no single dominant object in the center, low contrast/);
  assert.match(prompt, /Vietnamese/);
});

test('ниша не из словаря: фото строятся по английским подсказкам AI, а не по транслиту', () => {
  const project = { niche: 'кофейня', tier: 'standard', services: [['Авторский раф', ''], ['Эспрессо', '']],
    visualHints: { niche: 'specialty coffee shop', setting: 'a cozy coffee shop with a wooden bar and an espresso machine', hero: 'a barista pouring latte art',
      items: { 'Авторский раф': 'a glass of creamy raf coffee with vanilla foam', 'Эспрессо': 'кириллица отбрасывается' } } };
  const visual = nicheVisual(project);
  assert.equal(visual.en, 'specialty coffee shop');
  assert.match(visual.setting, /espresso machine/);
  assert.match(itemSubject('Авторский раф', visual, project.visualHints), /creamy raf coffee/);
  // Подсказка с кириллицей отброшена — остаётся прежний путь.
  const espresso = photoPrompt({ id: 'service-1', role: 'service', label: 'Эспрессо', aspect: '1:1' }, project);
  assert.ok(!/[а-яё]/i.test(espresso));
  const hero = photoPrompt({ id: 'hero', role: 'hero', label: 'Главное фото', aspect: '16:9' }, project);
  assert.match(hero, /specialty coffee shop/);
  assert.match(hero, /barista pouring latte art/);
  assert.ok(!/kofeynya/i.test(hero), 'транслит ниши больше не попадает в промт');
});

test('без подсказок поведение прежнее: словарь ниш и транслит как запасной путь', () => {
  assert.match(nicheVisual({ niche: 'гончарная мастерская', services: [] }).en, /Goncharnaya masterskaya/i);
  assert.match(nicheVisual({ niche: 'автосервис', services: [], visualHints: { niche: 'something else' } }).en, /car service/, 'словарь важнее подсказки');
});

test('кадры галереи берут сцены ниши от AI, а без них — 8 разных общих сюжетов', () => {
  const project = { niche: 'гончарная мастерская', tier: 'standard', services: [],
    visualHints: { niche: 'pottery workshop', gallery: ['hands shaping clay on a wheel', 'shelves of drying ceramics', 'кириллица отбрасывается'] } };
  const frame = n => photoPrompt({ id: 'gallery-' + n, role: 'gallery', label: 'Галерея, кадр ' + (n + 1), aspect: '4:5' }, project);
  assert.match(frame(0), /hands shaping clay on a wheel, at a pottery workshop/);
  assert.match(frame(1), /shelves of drying ceramics/);
  const plain = { niche: 'гончарная мастерская', tier: 'standard', services: [], visualHints: { niche: 'pottery workshop' } };
  const subjects = new Set(Array.from({ length: 8 }, (_, n) => photoPrompt({ id: 'gallery-' + n, role: 'gallery', label: 'x', aspect: '4:5' }, plain).match(/Subject: ([^.]*)\./)[1]));
  assert.equal(subjects.size, 8);
});

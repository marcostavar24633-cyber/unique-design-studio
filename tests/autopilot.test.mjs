// Автопилот: сайт по одной нише, класс проекта, подробный промт и разбор ответа AI-сервера.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NICHES, autopilot, buildPrompt, buildConcept, fromAiLanding, generate, normalizeProject, tierOf } from '../src/engine/index.js';

test('любая ниша собирается в проект без ошибок проверки', () => {
  const niches = ['ювелирная мастерская', 'школа сёрфинга', 'доставка устриц', 'магазин телескопов', 'кофейня', 'ремонт квартир', 'юрист по банкротству', 'студия йоги', 'что-то совсем новое'];
  let registry = [];
  for (const niche of niches) {
    const a = autopilot({ niche, email: 'hello@example.com' }, { registry });
    const r = generate(a.project, { registry });
    registry = r.registry;
    assert.deepEqual(r.audit.errors, [], niche);
    assert.ok(a.project.title && a.project.description && a.project.services.length >= 4, niche);
    assert.ok(a.analysis.segments.length >= 2 && a.analysis.objections.length && a.analysis.keywords.length, niche);
    assert.match(a.spec, /# ТЗ: главная страница/);
    assert.match(a.spec, /## 8\. Что уточнить у владельца/);
  }
});

test('для каждой ниши движка есть набор текстов', () => {
  for (const n of NICHES) {
    const a = autopilot({ niche: n.kw[0] instanceof RegExp ? n.label : n.kw[0] });
    assert.notEqual(a.analysis.profileId, undefined, n.id);
  }
});

test('общие слова не уводят в чужую нишу: «ювелирный салон» — не салон красоты', () => {
  assert.equal(autopilot({ niche: 'ювелирный салон' }).analysis.profileId, 'boutique');
  assert.equal(autopilot({ niche: 'салон красоты' }).analysis.profileId, 'beauty');
  assert.notEqual(autopilot({ niche: 'свадебный салон' }).analysis.profileId, 'beauty');
});

test('класс меняет концепцию: люкс — редакционная подача, антиква, контурные кнопки, без капсул', () => {
  assert.equal(tierOf('Люкс'), 'luxury');
  assert.equal(tierOf('премиум'), 'premium');
  assert.equal(tierOf('что угодно'), 'standard');
  const base = { niche: 'ювелирная мастерская', email: 'a@example.com' };
  const lux = generate(autopilot({ ...base, tier: 'luxury' }).project).concept;
  assert.ok(['editorial', 'immersive', 'minimal', 'asymmetric'].includes(lux.designDNA.primaryArchetype));
  assert.ok(['didone-contrast', 'serif-editorial'].includes(lux.visualSystem.typography.id));
  assert.ok(['outline', 'underline'].includes(lux.visualSystem.button.id));
  assert.notEqual(lux.visualSystem.shape.id, 'round');
  assert.match(lux.designDNA.selectionRationale, /люкс/i);
  assert.equal(normalizeProject({ niche: 'x', tier: 'luxury' }).tier, 'luxury');
});

test('подробный промт: тон класса, человеческий язык, исследование и строгий формат', () => {
  const a = autopilot({ niche: 'ювелирная мастерская', tier: 'luxury', city: 'Москва' });
  const p = a.prompt;
  for (const s of ['Класс: люкс', 'Никаких скидок', 'человеческим языком', 'Без канцелярита', 'researchSources', 'imagePrompts', 'Не выдумывай цены', 'Москва', 'seoTitle']) assert.ok(p.includes(s), s);
  const std = buildPrompt({ niche: 'кофейня' }, buildConcept({ niche: 'кофейня' }));
  assert.ok(std.includes('Класс: стандарт'));
});

test('тексты автопилота без канцелярита и без подсказок владельцу вне [заготовок]', () => {
  for (const n of NICHES) {
    const pr = autopilot({ niche: n.kw[0] instanceof RegExp ? n.label : n.kw[0] }).project;
    const text = [pr.title, pr.description, pr.servicesIntro, ...pr.services.flat(), ...pr.advantages.flat(), ...pr.process.flat(), ...pr.faqs.flat()].join(' ');
    assert.doesNotMatch(text.replace(/\[[^\]]*\]/g, ''), /уточня(ется|ются|йте)|осуществля|предоставля(ем|ет)|в кратчайшие сроки/i, n.id);
  }
});

test('незаполненные заготовки видны в проверке перед выдачей', () => {
  const a = autopilot({ niche: 'многопрофильный холдинг', email: 'a@example.com' });
  const r = generate(a.project);
  assert.ok(r.audit.warnings.some(w => w.id === 'placeholders'));
});

test('ответ AI-сервера превращается в проект и анализ; внешний вид выбирает движок', () => {
  const landing = {
    brand: 'Тихая гавань', niche: 'гостевой дом', title: 'Дом у моря для тихого отдыха', description: 'Восемь номеров в пяти минутах от пляжа.', cta: 'Выбрать даты',
    seoTitle: 'Гостевой дом у моря', seoDescription: 'Тихий отдых у моря', strategySummary: 'Забронировать проживание', targetAudience: 'Пары и семьи', mainOffer: 'Тишина у моря',
    visualDirection: 'светлое утро', designArchitecture: 'immersive', marketResearch: 'Наблюдения', segments: [{ name: 'Пары', need: 'тишина' }], objections: ['шумно'], triggers: ['отпуск'],
    keywords: ['гостевой дом у моря'], competitors: ['отели у трассы'], imagePrompts: ['утро на террасе'], researchSources: [{ title: 'Источник', url: 'https://example.com/a' }, { title: 'bad', url: 'http://x' }],
    assumptions: ['Цены уточнить'], style: 'Яркий', palette: 'Тёмная', accent: '#ff0000',
    aboutTitle: 'О доме', aboutText: 'Мы — семья.', servicesTitle: 'Номера', servicesIntro: 'Выберите номер.', services: [['Стандарт', 'Для двоих'], ['Семейный', 'Для четверых']],
    advantagesTitle: 'Почему у нас', advantagesIntro: '', advantages: [['Тишина', 'Нет трассы']], processTitle: 'Как забронировать', process: [['Даты', 'Выберите даты']],
    faqs: [['Есть парковка?', 'Да']], contactTitle: 'Пишите', contactText: 'Ответим',
  };
  const { project, analysis } = fromAiLanding(landing, { niche: 'гостевой дом', tier: 'premium', city: 'Анапа', email: 'a@example.com' });
  assert.equal(project.tier, 'premium');
  assert.equal(project.title, landing.title);
  assert.equal(project.palette, undefined, 'палитру из ответа не берём');
  assert.equal(project.designArchitecture, 'immersive');
  assert.equal(analysis.source, 'ai');
  assert.deepEqual(analysis.sources, [{ title: 'Источник', url: 'https://example.com/a' }], 'только https-источники');
  assert.equal(analysis.seo.title, 'Гостевой дом у моря');
  const r = generate(project);
  assert.deepEqual(r.audit.errors, []);
  assert.equal(r.concept.visualSystem.palette.accent === '#ff0000', false);
});

test('загруженные фото (data:URL) попадают на первый экран, в галерею и в карточки позиций', () => {
  const px = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  const a = autopilot({ niche: 'ювелирная мастерская', tier: 'luxury', email: 'a@example.com' });
  const p = { ...a.project, images: { hero: px, heroAlt: 'Кольцо на ладони' }, gallery: [{ src: px, caption: 'Мастерская', alt: 'Мастерская' }] };
  p.services = p.services.map((r, i) => (i === 0 ? [r[0], r[1], '', px] : r));
  const r = generate(p);
  const imgs = r.html.match(/<img[^>]+src="data:image\/webp/g) || [];
  assert.ok(imgs.length >= 2, `встроено фото: ${imgs.length}`);
  assert.match(r.html, /alt="Кольцо на ладони"/);
  assert.ok(!r.audit.warnings.some(w => w.id === 'no-images'), 'предупреждения «нет фото» быть не должно');
  assert.deepEqual(r.audit.errors, []);
});

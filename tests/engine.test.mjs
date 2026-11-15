// Тесты уникальности, адаптивности и доступности генератора.
// Запуск: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const E = createRequire(import.meta.url)("../engine/design-engine.js");

const NICHES = [
  ["Слопай букет", "съедобные букеты из ягод и мяса", "Ульяновск"],
  ["ПЕНКА", "кофейня на углу"],
  ["Photograf", "свадебный фотограф"],
  ["ДомА Тех", "интернет-магазин бытовой техники"],
  ["РАКОВАРНЯ 73", "раки с доставкой"],
  ["Hair", "парикмахерская"],
  ["Ровно", "ремонт и отделка квартир", "Ульяновск"],
  ["Звёздный", "магазин телескопов"],
  ["Право+", "налоговый юрист"],
  ["Шум", "фестиваль экспериментальной музыки"]
];

function series(list) {
  const history = [];
  for (const [brand, description, city] of list) history.push(E.createConcept({ brand, description, city }, history));
  return history;
}

test("концепция соответствует контракту из спецификации (раздел 8)", () => {
  const k = E.contractOf(E.createConcept({ brand: "ПЕНКА", description: "кофейня" }, []));
  for (const f of ["businessType", "audience", "primaryGoal", "brandCharacter", "contentPriority"]) assert.ok(k.designBrief[f], f);
  for (const f of ["primaryArchetype", "secondaryArchetype", "selectionRationale", "colorDirection", "typographyDirection", "imageDirection", "motionDirection"]) assert.ok(k.designDNA[f], f);
  for (const f of ["heroComposition", "navigationPattern", "sectionOrder", "primaryCTA"]) assert.ok(k.homepage[f], f);
  assert.equal(typeof k.uniquenessCheck.templateReuseDetected, "boolean");
  assert.ok(Array.isArray(k.uniquenessCheck.repeatedPatterns));
  assert.ok(Array.isArray(k.uniquenessCheck.differentiationActions));
  assert.notEqual(k.designDNA.primaryArchetype, k.designDNA.secondaryArchetype);
});

test("архитектура выбирается по нише (стартовые гипотезы раздела 10)", () => {
  const arch = (d) => E.createConcept({ brand: "X", description: d }, []).designDNA.primaryArchetype;
  assert.equal(arch("магазин бытовой техники"), "catalog");
  assert.equal(arch("магазин телескопов"), "catalog");
  assert.equal(arch("свадебный фотограф"), "immersive");
  assert.equal(arch("кофейня"), "editorial");
  assert.equal(arch("ремонт квартир"), "split-utility");
});

test("соседние проекты никогда не повторяют hero: архитектура + позиция визуала + типографика", () => {
  const all = series(NICHES.concat(NICHES)); // 20 проектов, ниши повторяются подряд
  for (let i = 1; i < all.length; i++) {
    const a = all[i - 1].designDNA, b = all[i].designDNA;
    const same = a.primaryArchetype === b.primaryArchetype && a.visualPosition === b.visualPosition && a.typeCharacter === b.typeCharacter;
    assert.equal(same, false, `${all[i - 1].designBrief.brand} → ${all[i].designBrief.brand}`);
    assert.equal(all[i].uniquenessCheck.templateReuseDetected, false);
  }
});

test("одна и та же ниша дважды подряд получает другую архитектуру и объяснение", () => {
  const [a, b] = series([["Букет 1", "съедобные букеты"], ["Букет 2", "съедобные букеты"]]);
  assert.notEqual(a.designDNA.primaryArchetype, b.designDNA.primaryArchetype);
  assert.ok(b.uniquenessCheck.differentiationActions.some((x) => x.includes("соседнего")));
});

test("ручной выбор архитектуры уважается, а конфликт с соседом решается зеркалом", () => {
  const first = E.createConcept({ brand: "A", description: "кофейня", architecture: "editorial" }, []);
  const second = E.createConcept({ brand: "B", description: "кофейня", architecture: "editorial" }, [first]);
  assert.equal(second.designDNA.primaryArchetype, "editorial");
  assert.equal(second.designDNA.mirrored, true);
  assert.notEqual(second.designDNA.visualPosition, first.designDNA.visualPosition);
  assert.ok(E.renderHomepage(second).includes('class="wrap hero mir"'));
});

test("10 ниш подряд дают не меньше 8 разных архитектур и разный HTML", () => {
  const all = series(NICHES);
  assert.ok(new Set(all.map((c) => c.designDNA.primaryArchetype)).size >= 8);
  const heroes = all.map((c) => E.renderHomepage(c).match(/<main[\s\S]*?<\/section>/)[0].replace(/>[^<]*</g, "><"));
  assert.ok(new Set(heroes).size >= 8, "разметка hero отличается структурно, а не только текстом");
});

test("все 10 архитектур рендерятся и проходят базовые проверки доступности", () => {
  for (const key of Object.keys(E.ARCHETYPES)) {
    const c = E.createConcept({ brand: "Тест", description: "кофейня", architecture: key }, []);
    const html = E.renderHomepage(c);
    assert.equal(c.designDNA.primaryArchetype, key);
    assert.match(html, /<html lang="ru">/, key);
    assert.match(html, /name="viewport" content="width=device-width/, key);
    assert.match(html, /prefers-reduced-motion:reduce/, key);
    assert.match(html, /:focus-visible/, key);
    assert.match(html, /class="skip" href="#main"/, key);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, key + ": ровно один h1");
    assert.match(html, /<main id="main">/, key);
    // У каждого поля формы есть label for
    for (const [, id] of html.matchAll(/<(?:input|textarea|select)[^>]*\sid="([^"]+)"/g)) assert.ok(html.includes(`for="${id}"`) || /type="radio"/.test(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0]), key + ": label для #" + id);
    assert.ok(c.quality.passed, key + ": " + c.quality.checks.filter((x) => !x.ok).map((x) => x.label).join("; "));
  }
});

test("адаптивность от 320 px: нет фиксированных ширин больше экрана", () => {
  for (const key of Object.keys(E.ARCHETYPES)) {
    const html = E.renderHomepage(E.createConcept({ brand: "T", description: "услуги", architecture: key }, []));
    assert.match(html, /overflow-x:hidden/);
    assert.match(html, /@media \(max-width:\d+px\)/, key + ": есть мобильная раскладка");
    for (const [, px] of html.matchAll(/(?:^|[;{])\s*(?:min-)?width:(\d+)px/g)) assert.ok(+px <= 320, `${key}: width ${px}px`);
  }
});

test("контраст палитр соответствует WCAG при любом тоне", () => {
  for (const tone of Object.keys(E.TONES)) for (const [brand, description] of NICHES) {
    const p = E.createConcept({ brand, description, tone }, []).designDNA.palette;
    assert.ok(E.util.contrast(p.text, p.bg) >= 7, `${brand}/${tone}: текст`);
    assert.ok(E.util.contrast(p.muted, p.bg) >= 4.5, `${brand}/${tone}: muted`);
    assert.ok(E.util.contrast(p.accentText, p.accent) >= 4.5, `${brand}/${tone}: кнопка`);
  }
});

test("тёмный фон с золотом не выдаётся по умолчанию", () => {
  for (const [brand, description] of NICHES) {
    const d = E.createConcept({ brand, description }, []).designDNA;
    if (d.mode !== "dark") continue;
    const hue = d.hue;
    assert.ok(Math.min(Math.abs(hue - 43), 360 - Math.abs(hue - 43)) >= 14, `${brand}: тон ${hue}`);
  }
});

test("генератор не выдумывает цены, отзывы и телефоны", () => {
  for (const c of series(NICHES)) {
    const html = E.renderHomepage(c);
    assert.doesNotMatch(html, /\d[\d\s]*(₽|руб)/, c.designBrief.brand + ": цена");
    assert.doesNotMatch(html, /\+7[\s(]*\d{3}/, c.designBrief.brand + ": телефон");
    assert.doesNotMatch(html, /★|\b\d{1,3}\s*отзыв/, c.designBrief.brand + ": отзывы");
    assert.ok(c.designBrief.assumptions.length >= 2);
  }
});

test("экспорт совместим с импортом Landing Studio", () => {
  const c = E.createConcept({ brand: "Ровно", description: "ремонт квартир" }, []);
  const p = E.toLandingStudioProject(c);
  assert.equal(p.format, "LandingStudioProject");
  assert.equal(p.version, 1);
  assert.equal(p.project.name, "Ровно");
  const d = p.project.data;
  assert.ok(["catalog", "editorial", "immersive", "service", "modular"].includes(d.designArchitecture));
  for (const f of ["brand", "niche", "title", "description", "cta", "style", "palette", "accent", "services"]) assert.ok(d[f] !== undefined, f);
  assert.ok(d.services.every((s) => Array.isArray(s) && s.length === 2));
  assert.equal(d.designDNA.primaryArchetype, c.designDNA.primaryArchetype);
  // Значения поля Landing Studio принимаются как ручной выбор архитектуры
  assert.equal(E.createConcept({ brand: "x", description: "кафе", architecture: "service" }, []).designDNA.primaryArchetype, "split-utility");
});

test("результат детерминирован для одинаковых входных данных", () => {
  const a = E.createConcept({ brand: "ПЕНКА", description: "кофейня" }, []);
  const b = E.createConcept({ brand: "ПЕНКА", description: "кофейня" }, []);
  assert.equal(E.renderHomepage(a), E.renderHomepage(b));
});

import test from "node:test";
import assert from "node:assert/strict";
import { createDesignConcept, DESIGN_ARCHETYPES } from "../src/design-director.js";

test("requires a business type", () => {
  assert.throws(() => createDesignConcept({}), /businessType is required/);
});

test("exposes ten distinct architecture options", () => {
  assert.equal(DESIGN_ARCHETYPES.length, 10);
  assert.equal(new Set(DESIGN_ARCHETYPES.map(item => item.id)).size, 10);
});

test("selects a catalog-oriented concept for a telescope store", () => {
  const concept = createDesignConcept({
    businessType: "магазин телескопов и оптических приборов",
    audience: "любители астрономии и начинающие наблюдатели",
    primaryGoal: "purchase",
    contentPriority: ["каталог", "характеристики", "сравнение", "подбор"]
  });
  assert.ok(["catalog", "product-first"].includes(concept.designDNA.primaryArchetype));
  assert.ok(concept.homepage.sectionOrder.includes("category-grid") || concept.homepage.sectionOrder.includes("featured-products"));
});

test("selects an immersive/editorial concept for a photographer portfolio", () => {
  const concept = createDesignConcept({
    businessType: "портфолио фотографа",
    audience: "пары и бренды",
    primaryGoal: "portfolio"
  });
  assert.ok(["immersive", "editorial"].includes(concept.designDNA.primaryArchetype));
});

test("uses booking-oriented structure for a hair salon", () => {
  const concept = createDesignConcept({
    businessType: "салон красоты и парикмахерская",
    audience: "женщины и мужчины, которым важны стрижка и окрашивание",
    primaryGoal: "booking"
  });
  assert.equal(concept.homepage.primaryCTA, "Записаться");
  assert.ok(concept.homepage.sectionOrder.includes("booking-form"));
});

test("changes architecture when recent history repeats the top choice", () => {
  const input = {
    businessType: "магазин телескопов и оптики",
    audience: "любители астрономии",
    primaryGoal: "purchase"
  };
  const first = createDesignConcept(input);
  const second = createDesignConcept({ ...input, history: [{
    primaryArchetype: first.designDNA.primaryArchetype,
    heroComposition: first.homepage.heroComposition,
    visualDirection: first.designDNA.visualDirection,
    typographyCharacter: first.designDNA.typographyDirection
  }] });
  assert.notEqual(second.designDNA.primaryArchetype, first.designDNA.primaryArchetype);
});

test("is deterministic for the same input", () => {
  const input = { businessType: "кофейня", businessName: "Пенка", primaryGoal: "inform" };
  assert.deepEqual(createDesignConcept(input), createDesignConcept(input));
});

test("rejects unsupported conversion goals", () => {
  assert.throws(() => createDesignConcept({ businessType: "магазин", primaryGoal: "whatever" }), /primaryGoal must be/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createStudioProject } from "../src/studio-pipeline.js";

test("builds a complete local project from a business brief", () => {
  const project = createStudioProject({
    businessType:"магазин телескопов и оптики",
    businessName:"Astro",
    audience:"начинающие астрономы и любители наблюдений",
    primaryGoal:"purchase",
    contentPriority:["каталог","подбор","сравнение характеристик"],
    contentBySection:{
      "category-grid":{title:"Каталог телескопов",description:"Подберите оптику для наблюдений."},
      "popular-items":{title:"Популярные модели",items:[{title:"Телескоп для начинающих",price:"12 000 ₽"}]}
    }
  });
  assert.equal(project.concept.designBrief.businessName,"Astro");
  assert.ok(project.visualIdentity.palette.id);
  assert.ok(project.layoutPlan.sections.length > 0);
  assert.match(project.html,/<!doctype html>/i);
  assert.match(project.html,/Каталог телескопов/);
  assert.equal(project.metadata.externalApiUsed,false);
});

test("uses different design signatures for distinct niches", () => {
  const telescope = createStudioProject({businessType:"магазин телескопов",primaryGoal:"purchase"});
  const photographer = createStudioProject({businessType:"портфолио фотографа",primaryGoal:"portfolio"});
  assert.notEqual(telescope.concept.designDNA.primaryArchetype,photographer.concept.designDNA.primaryArchetype);
  assert.notEqual(telescope.layoutPlan.shell,photographer.layoutPlan.shell);
  assert.notEqual(telescope.visualIdentity.metadata.signature,photographer.visualIdentity.metadata.signature);
});

test("applies explicit palette and shape selections", () => {
  const project = createStudioProject({
    businessType:"кофейня",
    businessName:"Пенка",
    primaryGoal:"inform",
    paletteId:"terracotta-cream",
    shapeId:"organic"
  });
  assert.equal(project.visualIdentity.palette.id,"terracotta-cream");
  assert.equal(project.visualIdentity.geometry.id,"organic");
  assert.equal(project.concept.designBrief.businessName,"Пенка");
});

test("rejects missing business type", () => {
  assert.throws(() => createStudioProject({}),/businessType is required/);
});

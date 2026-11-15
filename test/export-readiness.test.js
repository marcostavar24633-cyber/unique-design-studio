import test from "node:test";
import assert from "node:assert/strict";
import { assessExportReadiness } from "../src/export-readiness.js";
import { createStudioProject } from "../src/studio-pipeline.js";

const validHtml = `<!doctype html>
<html lang="ru"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Телескопы и оптика для наблюдений — Astro Shop</title>
<meta name="description" content="Выберите телескоп и оптику для наблюдений. Подбор оборудования для начинающих и опытных астрономов с консультацией специалистов.">
<style>@media (max-width: 767px) {.page{display:block}} :focus-visible{outline:3px solid currentColor} @media (prefers-reduced-motion: reduce) {*{animation:none}}</style>
</head><body><header><a href="#main">Наверх</a></header><main id="main"><h1>Телескопы для наблюдений</h1><img src="/scope.webp" width="800" height="600" alt="Телескоп для наблюдений"></main><footer>Astro Shop</footer></body></html>`;

test("allows a structurally complete page with no critical audit errors", () => {
  const result = assessExportReadiness(validHtml);
  assert.equal(result.ready,true);
  assert.equal(result.errors,0);
});

test("warnings are visible but do not block export", () => {
  const result = assessExportReadiness(validHtml.replace(/<style[\s\S]*?<\/style>/,"<style>@media (max-width:767px){.x{display:block}}</style>"));
  assert.equal(result.ready,true);
  assert.ok(result.warnings > 0);
});

test("blocks export when critical audit errors are present", () => {
  const result = assessExportReadiness(validHtml.replace('<meta name="viewport" content="width=device-width, initial-scale=1">',""));
  assert.equal(result.ready,false);
  assert.ok(result.blockingIssues.some(item => item.code === "viewport-missing"));
});

test("blocks empty or structurally incomplete HTML", () => {
  assert.equal(assessExportReadiness("").ready,false);
  const result = assessExportReadiness("<html><head></head><body></body></html>");
  assert.equal(result.ready,false);
  assert.ok(result.blockingIssues.some(item => item.code === "export-doctype-missing"));
  assert.ok(result.blockingIssues.some(item => item.code === "export-inline-css-missing"));
});

test("blocks unsafe links through the underlying site audit", () => {
  const result = assessExportReadiness(validHtml.replace('href="#main"','href="javascript:alert(1)"'));
  assert.equal(result.ready,false);
  assert.ok(result.blockingIssues.some(item => item.code === "unsafe-links"));
});

test("generated site keeps its SEO metadata and project content through the export gate", () => {
  const input = {
    businessType:"магазин телескопов",
    businessName:"Astro Shop",
    audience:"любители астрономии",
    primaryGoal:"purchase",
    description:"Телескопы и оптика для наблюдений за планетами, Луной и звёздным небом.",
    seoTitle:"Astro Shop — телескопы и оптика для наблюдений",
    seoDescription:"Подберите телескоп для наблюдений за планетами и звёздами. Консультации и доставка по России.",
    canonicalUrl:"https://astro.example/",
    ogImage:"https://astro.example/social.jpg"
  };
  // Same contract as app/app.js: the hero copy is passed through contentBySection
  // keyed by the first section id of the concept, not through a top-level heroTitle.
  const concept = createStudioProject(input);
  const heroId = concept.concept.homepage.sectionOrder[0];
  const project = createStudioProject({
    ...input,
    sectionOrder:[...concept.concept.homepage.sectionOrder],
    contentBySection:{
      [heroId]:{
        title:"Откройте Вселенную ближе",
        description:input.description,
        cta:{href:"#contact",label:"Подобрать телескоп"},
        image:{src:"data:image/png;base64,iVBORw0KGgo=",alt:"Телескоп для наблюдений за звёздным небом"}
      }
    }
  });
  const result = assessExportReadiness(project.html,project.css);
  assert.equal(result.ready,true,result.blockingIssues.map(item => item.code + ": " + item.detail).join("\n"));
  assert.ok(project.html.includes("<title>Astro Shop — телескопы и оптика для наблюдений</title>"));
  assert.ok(project.html.includes("Подберите телескоп для наблюдений за планетами и звёздами."));
  assert.ok(project.html.includes('rel="canonical" href="https://astro.example/"'));
  assert.ok(project.html.includes("https://astro.example/social.jpg"));
  assert.match(project.html,/<h1[^>]*>Откройте Вселенную ближе<\/h1>/);
  assert.ok(project.html.includes("Подобрать телескоп"));
  assert.ok(project.html.includes('alt="Телескоп для наблюдений за звёздным небом"'));
  assert.ok(project.html.includes("data:image/png;base64,iVBORw0KGgo="));
});

import test from "node:test";
import assert from "node:assert/strict";
import { createStudioProject } from "../src/studio-pipeline.js";
import { assessExportReadiness } from "../src/export-readiness.js";
import { createZip, verifyZipArchive } from "../src/zip-export.js";
import { DESIGN_ARCHETYPES } from "../src/design-director.js";

const LOCAL_IMAGE = "data:image/png;base64,iVBORw0KGgo=";

// Mirrors the two-step flow in app/app.js: build the concept first, then pass
// hero copy and section titles through contentBySection keyed by section id.
function buildLikeStudio(brief, heroTitle) {
  const draft = createStudioProject(brief);
  const order = [...draft.concept.homepage.sectionOrder];
  const [heroId, ...rest] = order;
  const contentBySection = {
    [heroId]:{
      title:heroTitle,
      description:brief.description,
      eyebrow:draft.concept.designDNA.primaryArchetypeLabel,
      cta:{href:"#contact",label:"Связаться"},
      image:{src:LOCAL_IMAGE,alt:"Изображение: " + brief.businessName}
    }
  };
  for (const id of rest) contentBySection[id] = {title:"Раздел " + id};
  return createStudioProject({...brief,sectionOrder:order,contentBySection});
}

const NICHES = [
  {businessType:"интернет-магазин товаров для дома",primaryGoal:"purchase",archetype:"product-first"},
  {businessType:"журнал о моде и красоте",primaryGoal:"inform",archetype:"editorial"},
  {businessType:"фотограф портфолио",primaryGoal:"portfolio",archetype:"immersive"},
  {businessType:"архитектура и дизайн студия",primaryGoal:"lead",archetype:"asymmetric"},
  {businessType:"каталог телескопов и оптики",primaryGoal:"purchase",archetype:"catalog"},
  {businessType:"салон парикмахер запись",primaryGoal:"booking",archetype:"split-utility"},
  {businessType:"кофейня ручной обжарки история",primaryGoal:"lead",archetype:"storytelling"},
  {businessType:"платформа b2b компания",primaryGoal:"lead",archetype:"modular"},
  {businessType:"андеграунд музыка культура",primaryGoal:"inform",archetype:"brutalist"},
  {businessType:"локальный лендинг заявка",primaryGoal:"lead",archetype:"minimal"}
];

test("regression niches cover every design architecture", () => {
  const covered = new Set(NICHES.map(item => item.archetype));
  assert.deepEqual([...covered].sort(),DESIGN_ARCHETYPES.map(item => item.id).sort());
});

for (const [index,niche] of NICHES.entries()) {
  test(`export gate keeps SEO, content and local image for ${niche.archetype}`, () => {
    const name = "Проект " + (index + 1);
    const brief = {
      businessType:niche.businessType,
      businessName:name,
      primaryGoal:niche.primaryGoal,
      description:"Описание проекта " + name + " для проверки экспорта.",
      seoTitle:name + " — " + niche.businessType,
      seoDescription:"SEO-описание для " + name + ": проверка сохранения метаданных при экспорте сайта.",
      canonicalUrl:"https://site-" + (index + 1) + ".example/",
      ogImage:"https://site-" + (index + 1) + ".example/og.jpg"
    };
    const heroTitle = "Главный экран " + name;
    const project = buildLikeStudio(brief,heroTitle);
    assert.equal(project.concept.designDNA.primaryArchetype,niche.archetype);

    const result = assessExportReadiness(project.html,project.css);
    assert.equal(result.ready,true,result.blockingIssues.map(item => item.code + ": " + item.detail).join("\n"));
    assert.ok(project.html.includes("<title>" + brief.seoTitle + "</title>"));
    assert.ok(project.html.includes(brief.seoDescription));
    assert.ok(project.html.includes('rel="canonical" href="' + brief.canonicalUrl + '"'));
    assert.ok(project.html.includes(brief.ogImage));
    assert.match(project.html,new RegExp("<h1[^>]*>" + heroTitle + "</h1>"));
    assert.ok(project.html.includes(LOCAL_IMAGE));
    assert.ok(project.html.includes('alt="Изображение: ' + name + '"'));
    for (const id of project.sectionOrder.slice(1)) assert.ok(project.html.includes("Раздел " + id),id);
  });
}

test("ZIP always carries exactly the latest HTML after an edit", () => {
  const brief = {businessType:"каталог телескопов и оптики",businessName:"Astro",primaryGoal:"purchase",description:"Телескопы."};
  const files = html => [{name:"index.html",content:html},{name:"README.txt",content:"Откройте index.html"}];
  const names = ["index.html","README.txt"];

  const first = buildLikeStudio(brief,"Первая версия");
  const firstZip = createZip(files(first.html));
  assert.equal(verifyZipArchive(firstZip,names,{"index.html":first.html}).valid,true);

  const edited = buildLikeStudio(brief,"Вторая версия");
  assert.notEqual(edited.html,first.html);
  assert.ok(assessExportReadiness(edited.html,edited.css).ready);

  // A stale archive must not pass verification against the latest HTML.
  const stale = verifyZipArchive(firstZip,names,{"index.html":edited.html});
  assert.equal(stale.valid,false);

  const latestZip = createZip(files(edited.html));
  const fresh = verifyZipArchive(latestZip,names,{"index.html":edited.html,"README.txt":"Откройте index.html"});
  assert.equal(fresh.valid,true,fresh.errors?.join("; "));
});

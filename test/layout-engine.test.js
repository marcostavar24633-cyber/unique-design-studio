import test from "node:test";
import assert from "node:assert/strict";
import { createLayoutPlan, renderLayoutCss, LAYOUT_ARCHETYPES } from "../src/layout-engine.js";

test("creates a responsive page plan from a Design Director concept", () => {
  const plan = createLayoutPlan({
    concept:{
      designDNA:{primaryArchetype:"catalog"},
      homepage:{sectionOrder:["category-grid","popular-items","selection-guide","faq"]}
    },
    visualIdentity:{cssVariables:{"--uds-color-bg":"#fff"}}
  });
  assert.equal(plan.archetype,"catalog");
  assert.equal(plan.shell,"catalog-led");
  assert.equal(plan.sections[0].component,"category-bento");
  assert.equal(plan.responsive.mobile,"2-column product grid; filters become an accessible disclosure");
  assert.equal(plan.cssVariables["--uds-color-bg"],"#fff");
});

test("supports explicit section component and content overrides", () => {
  const plan = createLayoutPlan({
    archetype:"editorial",
    sections:[{id:"hero",component:"custom-cover",title:"A title",content:{lead:"A lead"}}]
  });
  assert.equal(plan.sections[0].component,"custom-cover");
  assert.deepEqual(plan.sections[0].content,{lead:"A lead"});
});

test("rejects missing and duplicate sections", () => {
  assert.throws(() => createLayoutPlan({archetype:"minimal",sections:[]}), /non-empty sections/);
  assert.throws(() => createLayoutPlan({archetype:"minimal",sections:["faq","faq"]}), /Duplicate section id/);
});

test("defines all ten supported architecture layouts", () => {
  assert.equal(LAYOUT_ARCHETYPES.length,10);
});

test("renders responsive CSS with reduced motion and safe CSS variables", () => {
  const plan = createLayoutPlan({
    archetype:"minimal",
    sections:["focused-hero","single-cta"],
    visualIdentity:{cssVariables:{"--uds-color-bg":"#fff","--unsafe":"red; body{}"}}
  });
  const css = renderLayoutCss(plan);
  assert.match(css,/--uds-color-bg: #fff/);
  assert.doesNotMatch(css,/--unsafe/);
  assert.match(css,/@media \(max-width: 767px\)/);
  assert.match(css,/prefers-reduced-motion/);
});

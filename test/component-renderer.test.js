import test from "node:test";
import assert from "node:assert/strict";
import { renderHtmlPage, renderComponentCss } from "../src/component-renderer.js";

const plan = {
  shell:"catalog-led",
  sections:[
    {id:"hero",key:"hero",component:"product-hero",content:{eyebrow:"Оптика",title:"Телескопы для наблюдений",description:"Подберите инструмент.",image:{src:"/images/telescope.webp",alt:"Телескоп"},cta:{href:"#catalog",label:"В каталог"}}},
    {id:"catalog",key:"catalog",component:"product-grid",content:{title:"Популярные модели",items:[{title:"Модель 1",description:"Для начинающих",price:"12 000 ₽",image:{src:"/images/item.webp",alt:"Модель 1"},link:{href:"/product/1",label:"Подробнее"}}]}},
    {id:"booking",key:"booking",component:"booking-form",content:{title:"Заказать звонок",form:{fields:[{name:"phone",label:"Телефон",type:"tel",required:true}]}}}
  ]
};

test("renders a complete semantic HTML document", () => {
  const html = renderHtmlPage({layoutPlan:plan,businessName:"Astro Shop",description:"Оптика для астрономов",navigation:[{label:"Каталог",href:"#catalog"}],css:renderComponentCss()});
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/<main class="uds-main">/);
  assert.match(html,/<h1[^>]*>Телескопы для наблюдений<\/h1>/);
  assert.match(html,/aria-label="Основная навигация"/);
  assert.match(html,/name="phone"/);
});

test("escapes untrusted content and rejects javascript URLs", () => {
  const unsafePlan = {shell:"focused",sections:[{id:"hero",key:"hero",component:"product-hero",content:{title:"<script>alert(1)</script>",cta:{href:"javascript:alert(1)",label:"Click"}}}]};
  const html = renderHtmlPage({layoutPlan:unsafePlan});
  assert.doesNotMatch(html,/<script>alert/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/javascript:/);
});

test("renders item cards and lazy-loaded safe images", () => {
  const html = renderHtmlPage({layoutPlan:plan});
  assert.match(html,/class="uds-card"/);
  assert.match(html,/loading="lazy"/);
  assert.match(html,/Телескоп/);
});

test("rejects invalid page plans", () => {
  assert.throws(() => renderHtmlPage({}), /valid layoutPlan/);
});

test("provides responsive component CSS and focus styles", () => {
  const css = renderComponentCss({cssVariables:{"--uds-color-bg":"#fafafa","--uds-radius-lg":"24px"}});
  assert.match(css,/@media \(max-width: 767px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(css,/min-height: 48px/);
});

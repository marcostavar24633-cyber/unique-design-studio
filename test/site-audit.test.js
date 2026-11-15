import test from "node:test";
import assert from "node:assert/strict";
import { auditSiteHtml } from "../src/site-audit.js";

const cleanHtml = `<!doctype html>
<html lang="ru"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Телескопы и оптика для наблюдений — Astro Shop</title>
<meta name="description" content="Выберите телескоп и оптику для наблюдений. Подбор оборудования для начинающих и опытных астрономов с консультацией специалистов.">
<meta property="og:title" content="Astro Shop — телескопы">
<meta property="og:description" content="Оптика для наблюдений и изучения космоса.">
<meta property="og:image" content="https://example.com/social.jpg">
<link rel="canonical" href="https://example.com/">
</head><body><header><a href="#main">Наверх</a></header><main id="main"><h1>Телескопы для наблюдений</h1><h2>Каталог</h2><img src="/scope.webp" width="800" height="600" alt="Телескоп для наблюдений"></main><footer>Astro Shop</footer></body></html>`;
const cleanCss = `@media (max-width: 767px) {.page{display:block}}
:focus-visible{outline:3px solid currentColor}
@media (prefers-reduced-motion: reduce) {*{animation:none}}
.uds-button{min-height:48px}`;

test("accepts complete SEO metadata, landmarks and responsive accessibility CSS", () => {
  const report = auditSiteHtml(cleanHtml,cleanCss);
  assert.equal(report.errors,0);
  assert.equal(report.warnings,0);
  assert.equal(report.score,100);
  assert.equal(report.metrics.h1Count,1);
  assert.equal(report.metrics.imagesMissingAlt,0);
  assert.equal(report.metrics.mobileBreakpoint,true);
  assert.equal(report.metrics.focusStyle,true);
  assert.equal(report.metrics.reducedMotion,true);
});

test("finds missing SEO fields, missing image alt and duplicate IDs", () => {
  const report = auditSiteHtml('<html><head><title>Short</title></head><body><h1>A</h1><h1>B</h1><img src="/a.jpg"><div id="x"></div><div id="x"></div><a href="#missing">Go</a></body></html>');
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes("description-missing"));
  assert.ok(codes.includes("image-alt-missing"));
  assert.ok(codes.includes("duplicate-ids"));
  assert.ok(codes.includes("broken-fragments"));
  assert.ok(codes.includes("og-metadata-missing"));
  assert.ok(codes.includes("canonical-missing"));
  assert.ok(codes.includes("viewport-missing"));
  assert.ok(codes.includes("mobile-css-missing"));
});

test("warns about demo forms and heading hierarchy", () => {
  const report = auditSiteHtml('<html lang="ru"><head><title>Some sufficiently long SEO title for testing</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="A description long enough to exceed the minimum threshold and give search engines context about the page content."></head><body><header></header><main><h1>Title</h1><h3>Skipped level</h3><form data-uds-demo-form="true"></form></main><footer></footer></body></html>',cleanCss);
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes("heading-order"));
  assert.ok(codes.includes("demo-form"));
});

test("checks accessible link names, external rel and labelled form controls", () => {
  const report = auditSiteHtml('<html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>A sufficiently long title for a page about products and services</title><meta name="description" content="A description long enough to provide a useful summary of the content and the value proposition for search visitors."></head><body><header></header><main><h1>Page</h1><a href="https://example.com" target="_blank"> </a><a></a><form><input id="phone" type="tel"></form></main><footer></footer></body></html>',cleanCss);
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes("external-link-rel"));
  assert.ok(codes.includes("empty-links"));
  assert.ok(codes.includes("unlabeled-links"));
  assert.ok(codes.includes("form-labels"));
});

test("detects large embedded images and missing intrinsic dimensions", () => {
  const huge = "A".repeat(420000);
  const html = '<html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>A sufficiently long title for a product website with details</title><meta name="description" content="A description long enough to provide a useful summary of the content and the value proposition for search visitors."></head><body><header></header><main><h1>Page</h1><img src="data:image/png;base64,' + huge + '" alt="Product"></main><footer></footer></body></html>';
  const report = auditSiteHtml(html,cleanCss);
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes("large-embedded-images"));
  assert.ok(codes.includes("image-dimensions"));
});

test("returns a diagnostic report for empty input", () => {
  const report = auditSiteHtml("");
  assert.ok(report.score < 100);
  assert.ok(report.errors >= 2);
});


test("flags buttons without an accessible name", () => {
  const report = auditSiteHtml('<html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>A sufficiently long title for a page about products and services</title><meta name="description" content="A description long enough to provide a useful summary of the content and the value proposition for search visitors."></head><body><header></header><main><h1>Page</h1><button></button><button aria-label="Close"></button></main><footer></footer></body></html>',cleanCss);
  assert.ok(report.issues.some(item => item.code === "unlabeled-buttons"));
  assert.equal(report.metrics.unlabeledButtons,1);
});

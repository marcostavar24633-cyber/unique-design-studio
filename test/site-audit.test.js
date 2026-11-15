import test from "node:test";
import assert from "node:assert/strict";
import { auditSiteHtml } from "../src/site-audit.js";

const cleanHtml = `<!doctype html>
<html lang="ru"><head>
<title>Телескопы и оптика для наблюдений — Astro Shop</title>
<meta name="description" content="Выберите телескоп и оптику для наблюдений. Подбор оборудования для начинающих и опытных астрономов с консультацией специалистов.">
<meta property="og:title" content="Astro Shop — телескопы">
<meta property="og:description" content="Оптика для наблюдений и изучения космоса.">
<meta property="og:image" content="https://example.com/social.jpg">
<link rel="canonical" href="https://example.com/">
</head><body><main id="main"><h1>Телескопы для наблюдений</h1><h2>Каталог</h2><img src="/scope.webp" alt="Телескоп для наблюдений"><a href="#main">Наверх</a></main></body></html>`;

test("accepts complete SEO metadata and a sound basic document structure", () => {
  const report = auditSiteHtml(cleanHtml);
  assert.equal(report.errors,0);
  assert.equal(report.warnings,0);
  assert.equal(report.score,100);
  assert.equal(report.metrics.h1Count,1);
  assert.equal(report.metrics.imagesMissingAlt,0);
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
});

test("warns about demo forms and heading hierarchy", () => {
  const report = auditSiteHtml('<html lang="ru"><head><title>Some sufficiently long SEO title for testing</title><meta name="description" content="A description long enough to exceed the minimum threshold and give search engines context about the page content."></head><body><h1>Title</h1><h3>Skipped level</h3><form data-uds-demo-form="true"></form></body></html>');
  const codes = report.issues.map(item => item.code);
  assert.ok(codes.includes("heading-order"));
  assert.ok(codes.includes("demo-form"));
});

test("returns a safe empty report for non-HTML input", () => {
  const report = auditSiteHtml("");
  assert.equal(report.score,0);
  assert.ok(report.errors >= 2);
});

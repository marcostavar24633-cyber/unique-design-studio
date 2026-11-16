// Регрессионные проверки безопасности (см. SECURITY-AUDIT.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { generate } from '../src/engine/index.js';
import { safeUrl } from '../src/engine/util.js';
import { normalizeProject } from '../src/engine/project.js';

const XSS = '"><script>alert(1)</script><img src=x onerror=alert(1)>';
const evil = {
  brand: XSS, niche: 'кофейня ' + XSS, title: XSS, subtitle: XSS, cta: XSS, about: XSS,
  ctaUrl: 'javascript:alert(1)', formAction: 'javascript:alert(1)',
  services: [[XSS, XSS]], contacts: { email: 'a@b.c' + XSS, phone: XSS, address: XSS },
  images: { hero: 'javascript:alert(1)' },
  gallery: [{ src: 'data:text/html,<script>alert(1)</script>', alt: XSS, caption: XSS }],
  accent: '#fff" onmouseover="alert(1)',
};

test('вредоносные данные проекта не превращаются в код на странице', () => {
  const { html } = generate(evil);
  assert.doesNotMatch(html, /<script>alert/i);
  assert.doesNotMatch(html, /<img src=x onerror/i);
  assert.doesNotMatch(html, /onmouseover=/i);
  assert.doesNotMatch(html, /(href|src|action)="\s*javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  for (const ld of html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    assert.ok(!ld.slice(0, -9).includes('</'), 'JSON-LD не закрывает тег раньше времени');
  }
});

test('safeUrl пропускает только безопасные схемы', () => {
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'vbscript:x', 'data:text/html,x', '//evil.example']) assert.equal(safeUrl(bad), '', bad);
  assert.equal(safeUrl('data:image/png;base64,AAA', { image: true }), 'data:image/png;base64,AAA');
  assert.equal(safeUrl('data:image/png;base64,AAA'), '', 'data-изображение не годится как ссылка');
  assert.equal(safeUrl('mailto:a@b.c', { image: true }), '');
  assert.equal(safeUrl('https://example.com'), 'https://example.com');
});

test('цвет акцента принимается только в виде HEX', () => {
  assert.equal(normalizeProject({ accent: evil.accent }).accent, '');
  assert.equal(normalizeProject({ accent: '#A1B2C3' }).accent.toLowerCase(), '#a1b2c3');
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildConcept } from "../src/engine/concept.js";
import { renderSite } from "../src/engine/render.js";

const project = {
  brand: "Studio Test",
  niche: "дизайн-студия",
  title: "Создаём пространства",
  description: "Тестовая страница",
  cta: "Связаться",
};

test("keeps the existing renderer appearance unless Visual Identity is explicitly enabled", () => {
  const concept = buildConcept(project);
  const html = renderSite(project, concept);
  assert.doesNotMatch(html, /has-visual-identity/);
  assert.doesNotMatch(html, /--ds-bg:#10131B/);
});

test("applies the selected Visual Identity palette and geometry to rendered HTML", () => {
  const input = {
    ...project,
    visualIdentityEnabled: true,
    visualIdentityPaletteId: "midnight-cinema",
    visualIdentityShapeId: "soft-geometry",
  };
  const concept = buildConcept(input);
  const html = renderSite(input, concept);
  assert.match(html, /--ds-bg:#10131B/);
  assert.match(html, /--ds-accent:#E0A56A/);
  assert.match(html, /--ds-radius-md:18px/);
});

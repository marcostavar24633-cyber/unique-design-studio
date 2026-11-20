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

test('каждая палитра Visual Identity в готовой странице проходит WCAG AA, а шрифты запрашиваются только существующими начертаниями', async () => {
  const { listVisualIdentityOptions } = await import('../src/visual-identity.js');
  const { contrast } = await import('../src/engine/color.js');
  const { visualIdentityTokens, visualIdentityFonts } = await import('../src/engine/render.js');
  const { createVisualIdentity } = await import('../src/visual-identity.js');
  const { buildConcept } = await import('../src/engine/index.js');
  const concept = buildConcept({ niche: 'кофейня', brand: 'Проверка' });
  for (const { id } of listVisualIdentityOptions().palettes) {
    const identity = createVisualIdentity({ concept, businessType: 'кофейня', businessName: 'Проверка', identitySeed: 'aa', paletteId: id });
    const p = visualIdentityTokens(identity);
    assert.equal(p.accent, identity.palette.accent, `${id}: цвет кнопки не меняется`);
    for (const [name, fg, bg, min] of [['текст/фон', p.text, p.background, 4.5], ['вторичный/фон', p.muted, p.background, 4.5], ['вторичный/поверхность', p.muted, p.surface, 4.5],
      ['кнопка', p.accentText, p.accent, 4.5], ['акцентный текст/фон', p.accentInk, p.background, 4.5], ['акцентный текст/поверхность', p.accentInk, p.surface, 4.5]]) {
      assert.ok(contrast(fg, bg) >= min, `${id}: ${name} ${contrast(fg, bg).toFixed(2)}:1`);
    }
  }
  const fonts = visualIdentityFonts({ typography: { display: 'Archivo Black', body: 'DM Sans' } });
  assert.deepEqual(fonts, [{ family: 'Archivo Black', weights: '400' }, { family: 'DM Sans', weights: '400;500;600;700' }]);
  assert.equal(visualIdentityFonts({ typography: { display: 'Inter', body: 'Inter' } }).length, 1, 'одна гарнитура запрашивается один раз');
});

import test from "node:test";
import assert from "node:assert/strict";
import { createVisualIdentity, listVisualIdentityOptions } from "../src/visual-identity.js";

test("creates a complete visual identity from a Design Director concept", () => {
  const identity = createVisualIdentity({
    concept: {
      designBrief:{ businessType:"магазин телескопов", businessName:"Astro" },
      designDNA:{ primaryArchetype:"catalog", motionDirection:"fast filter feedback" }
    }
  });
  assert.equal(identity.archetype, "catalog");
  assert.ok(identity.palette.accent.startsWith("#"));
  assert.ok(identity.typography.display);
  assert.ok(identity.geometry.radius.medium);
  assert.ok(identity.cssVariables["--uds-color-bg"]);
  assert.equal(identity.interaction.reducedMotionRequired, true);
});

test("selects distinct visual systems for different architecture families", () => {
  const editorial = createVisualIdentity({ businessType:"журнал", archetype:"editorial", identitySeed:"a" });
  const catalog = createVisualIdentity({ businessType:"магазин", archetype:"catalog", identitySeed:"a" });
  assert.notEqual(editorial.layout.grid, catalog.layout.grid);
  assert.notEqual(editorial.graphics.style, catalog.graphics.style);
});

test("is deterministic for the same project identity", () => {
  const input = { businessType:"кофейня", businessName:"Пенка", archetype:"storytelling" };
  assert.deepEqual(createVisualIdentity(input), createVisualIdentity(input));
});

test("supports explicit palette and shape overrides", () => {
  const identity = createVisualIdentity({
    businessType:"студия",
    archetype:"minimal",
    paletteId:"electric-paper",
    shapeId:"hard-editorial"
  });
  assert.equal(identity.palette.id, "electric-paper");
  assert.equal(identity.geometry.id, "hard-editorial");
});

test("rejects unknown palette and shape identifiers", () => {
  assert.throws(() => createVisualIdentity({ businessType:"x", archetype:"minimal", paletteId:"unknown" }), /Unknown paletteId/);
  assert.throws(() => createVisualIdentity({ businessType:"x", archetype:"minimal", shapeId:"unknown" }), /Unknown shapeId/);
});

test("exposes reusable option catalogs", () => {
  const options = listVisualIdentityOptions();
  assert.ok(options.palettes.length >= 12);
  assert.equal(options.shapes.length, 5);
  assert.equal(options.archetypes.length, 10);
});

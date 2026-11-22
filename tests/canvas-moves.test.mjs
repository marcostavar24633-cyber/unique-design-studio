import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasEditsRuntime, canvasFanPlacements, canvasMovesRuntime } from '../src/engine/canvas.js';
import { exportProject, normalizeProject } from '../src/engine/project.js';
import { generate } from '../src/engine/index.js';

test('free-canvas moves are bounded, rendered and ignore invalid targets', () => {
  const html = canvasMovesRuntime({
    'u:about:1': { sectionId: 'gallery', x: 135, y: -20 },
    'u:items:2': { sectionId: 'bad" onclick="x', x: 40, y: 40 },
    'invalid-key': { sectionId: 'hero', x: 50, y: 50 },
  });
  assert.match(html, /dataset\.udsEditKey=/);
  assert.match(html, /"u:about:1","gallery",100,0/);
  assert.doesNotMatch(html, /onclick/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'runtime script is present');
  assert.doesNotThrow(() => new Function(script), 'runtime script parses');
  assert.equal(canvasMovesRuntime({}), '');
});

test('free-canvas stacking order is bounded and persisted as z-index', () => {
  const html = canvasEditsRuntime({ 'u:media-gallery:3': { zIndex: 8 } });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'edit runtime script is present');
  assert.match(script, /Math\.max\(-100,Math\.min\(100,Math\.trunc\(\+e\.zIndex\)\)\)/);
  assert.doesNotThrow(() => new Function(script), 'edit runtime script parses');
});

test('five photos receive a centered fan with alternating angles and stable layers', () => {
  const keys = Array.from({ length: 5 }, (_, i) => `u:media-gallery:${i + 1}`);
  assert.deepEqual(canvasFanPlacements(keys), [
    { key: keys[0], x: 32, y: 57, rotation: -18, zIndex: 0 },
    { key: keys[1], x: 41, y: 50, rotation: -9, zIndex: 1 },
    { key: keys[2], x: 50, y: 46, rotation: 0, zIndex: 2 },
    { key: keys[3], x: 59, y: 50, rotation: 9, zIndex: 3 },
    { key: keys[4], x: 68, y: 57, rotation: 18, zIndex: 4 },
  ]);
  assert.equal(canvasFanPlacements(keys.slice(1)), null);
  assert.equal(canvasFanPlacements([...keys.slice(1), keys[1]]), null);
});

test('free-canvas placement survives project export and import', () => {
  const move = { sectionId: 'gallery', x: 62.5, y: 31 };
  const project = normalizeProject({ brand: 'Studio', niche: 'design', canvasMoves: { 'u:about:1': move } });
  const exported = exportProject(project);
  const restored = normalizeProject(JSON.parse(JSON.stringify(exported)));
  assert.deepEqual(restored.passthrough.canvasMoves, { 'u:about:1': move });
  const generated = generate(exported);
  assert.match(generated.html, /"u:about:1","gallery",62\.5,31/);
});

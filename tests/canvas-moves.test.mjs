import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasMovesRuntime } from '../src/engine/canvas.js';
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

test('free-canvas placement survives project export and import', () => {
  const move = { sectionId: 'gallery', x: 62.5, y: 31 };
  const project = normalizeProject({ brand: 'Studio', niche: 'design', canvasMoves: { 'u:about:1': move } });
  const exported = exportProject(project);
  const restored = normalizeProject(JSON.parse(JSON.stringify(exported)));
  assert.deepEqual(restored.passthrough.canvasMoves, { 'u:about:1': move });
  const generated = generate(exported);
  assert.match(generated.html, /"u:about:1","gallery",62\.5,31/);
});

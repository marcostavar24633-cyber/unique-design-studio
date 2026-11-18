// Задание для Worker студии — без расширенного контракта для внешних AI: иначе противоречие с форматом Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { autopilot } from '../src/engine/autopilot.js';

test('для внешних AI — полный контракт, для Worker студии — только поля, которые студия читает', () => {
  const input = { niche: 'кафе вьетнамская кухня', city: 'Ульяновск', email: 'a@b.ru' };
  const full = autopilot(input, { registry: [] }).prompt;
  const worker = autopilot(input, { registry: [], forWorker: true }).prompt;
  for (const f of ['brandStrategy', 'audienceProfiles', 'conversionMap', 'qualityReport']) {
    assert.ok(full.includes(f), `внешний: ${f}`);
    assert.ok(!worker.includes(f), `Worker: ${f}`);
  }
  assert.match(worker, /imagePrompts \[строки\], researchSources \[\{title, url\}\], assumptions \[строки\]\./);
  assert.ok(worker.length < full.length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_MANAGER_KEY, PROMPT_LIMITS, emptyPromptRegistry, loadPromptRegistry, savePromptRegistry,
  savePromptVersion, activatePromptVersion, activePrompt, exportPromptRegistry, importPromptRegistry,
} from '../src/engine/prompt-manager.js';

test('empty registry contains all module buckets', () => {
  const registry = emptyPromptRegistry();
  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.modules['landing-copy']);
  assert.ok(registry.modules['image-generation']);
});

test('load and save use the supplied storage and round-trip versions', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const next = savePromptVersion(emptyPromptRegistry(), 'landing-copy', 'Write concise, factual copy.', 'Initial');
  const saved = savePromptRegistry(next, storage);
  assert.equal(saved.ok, true);
  assert.equal(activePrompt(loadPromptRegistry(storage), 'landing-copy'), 'Write concise, factual copy.');
  assert.ok(data.has(PROMPT_MANAGER_KEY));
});

test('storage getter failures do not escape load or save', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.equal(loadPromptRegistry().schemaVersion, 1);
    const result = savePromptRegistry(emptyPromptRegistry());
    assert.equal(result.ok, false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('versions can be activated and exported/imported', () => {
  let registry = savePromptVersion(emptyPromptRegistry(), 'landing-copy', 'Version one');
  registry = savePromptVersion(registry, 'landing-copy', 'Version two');
  registry = activatePromptVersion(registry, 'landing-copy', 1);
  assert.equal(activePrompt(registry, 'landing-copy'), 'Version one');
  const restored = importPromptRegistry(exportPromptRegistry(registry));
  assert.equal(activePrompt(restored, 'landing-copy'), 'Version one');
});

test('image instructions must be English and fit the worker budget', () => {
  assert.throws(() => savePromptVersion(emptyPromptRegistry(), 'image-generation', 'Добавить мягкий свет'), /английском/);
  assert.throws(() => savePromptVersion(emptyPromptRegistry(), 'image-generation', 'x'.repeat(1001)), /1[\\s\\u00a0]000 символов/);
  assert.doesNotThrow(() => savePromptVersion(emptyPromptRegistry(), 'image-generation', 'Soft cinematic side light.'));
});

test('each module enforces its own payload budget', () => {
  assert.equal(PROMPT_LIMITS['design-director'], 1800);
  assert.throws(() => savePromptVersion(emptyPromptRegistry(), 'content-director', 'x'.repeat(1501)), /1[\\s\\u00a0]500/);
  assert.throws(() => savePromptVersion(emptyPromptRegistry(), 'market-research', 'x'.repeat(1501)), /1 500/);
});

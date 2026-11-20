import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadEmergencyBackup, scheduleEmergencyBackup } from '../studio/project-storage.js';

test('emergency storage module is syntactically valid and wired into the studio', () => {
  const check = spawnSync(process.execPath, ['--check', 'studio/project-storage.js'], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const source = readFileSync(new URL('../studio/studio.js', import.meta.url), 'utf8');
  assert.ok(source.includes("from './project-storage.js'"));
  assert.ok(source.includes('scheduleEmergencyBackup(state, savedAt)'));
  assert.ok(source.includes('await restoreEmergencyBackupIfNewer()'));
  assert.ok(source.includes('saved._udsSavedAt'));
});

test('emergency storage reports unavailable IndexedDB instead of silently discarding the backup', async () => {
  await assert.rejects(loadEmergencyBackup(), /IndexedDB недоступен/);
  await assert.rejects(scheduleEmergencyBackup({ raw: { brand: 'test' } }, 1), /IndexedDB недоступен/);
});

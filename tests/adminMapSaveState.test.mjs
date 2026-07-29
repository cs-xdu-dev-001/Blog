import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-map.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/admin/map.astro', import.meta.url), 'utf8');

test('map editor saves an immutable snapshot and ignores stale response data', () => {
  assert.match(client, /const savingVersion = changeVersion/);
  assert.match(client, /const snapshot = JSON\.parse\(JSON\.stringify\(state\.config\)\)/);
  assert.match(client, /body: JSON\.stringify\(snapshot\)/);
  assert.match(client, /if \(changeVersion === savingVersion\)/);
  assert.match(client, /仍有未保存更改/);
});

test('map editor validates requests and always restores the save control', () => {
  assert.match(client, /if \(isSaving \|\| !state\.config\) return/);
  assert.match(client, /if \(!res\.ok\) throw new Error\(`读取失败/);
  assert.match(client, /if \(!res\.ok\) throw new Error\(`保存失败/);
  assert.match(client, /finally \{\s*isSaving = false;\s*saveButton\.disabled = false/);
  assert.match(page, /data-map-state data-state="idle" role="status" aria-live="polite"/);
});

test('map editor protects dirty state and supports the standard save shortcut', () => {
  assert.match(client, /function markDirty\(\)/);
  assert.match(client, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(client, /saveButton\.click\(\)/);
  assert.match(client, /if \(!dirty && !isSaving\) return/);
});

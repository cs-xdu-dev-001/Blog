import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const editors = [
  {
    page: read('src/pages/admin/reading/[id]/edit.astro'),
    client: read('public/admin-reading-editor.js'),
    saveHook: 'data-save-reading',
    stateHook: 'data-reading-editor-state',
  },
  {
    page: read('src/pages/admin/watch/[id]/edit.astro'),
    client: read('public/admin-watch-editor.js'),
    saveHook: 'data-save-watch',
    stateHook: 'data-watch-editor-state',
  },
  {
    page: read('src/pages/admin/topics/[slug]/edit.astro'),
    client: read('public/admin-topic-editor.js'),
    saveHook: 'data-save-topic',
    stateHook: 'data-topic-editor-state',
  },
];

test('dedicated admin editors keep save feedback visible beside the save action', () => {
  for (const editor of editors) {
    assert.match(editor.page, new RegExp(`cms-editor-actions[\\s\\S]*${editor.stateHook}[\\s\\S]*${editor.saveHook}`));
    assert.match(editor.page, /aria-live="polite"/);
  }
});

test('dedicated admin editors lock concurrent saves and surface network failures', () => {
  for (const editor of editors) {
    assert.match(editor.client, /let isSaving\s*=\s*false/);
    assert.match(editor.client, /saveButton\.disabled\s*=\s*true/);
    assert.match(editor.client, /finally\s*{/);
    assert.match(editor.client, /catch\s*\(error\)/);
    assert.match(editor.client, /登录已失效/);
  }
});

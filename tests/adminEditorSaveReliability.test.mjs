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
    page: read('src/pages/admin/food/[id]/edit.astro'),
    client: read('public/admin-food-editor.js'),
    saveHook: 'data-save-food',
    stateHook: 'data-food-editor-state',
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

const mediaEditors = [
  read('public/admin-reading-editor.js'),
  read('public/admin-watch-editor.js'),
  read('public/admin-food-editor.js'),
];

test('media editors save dirty fields before uploading and lock destructive operations', () => {
  for (const client of mediaEditors) {
    assert.match(client, /dirty && !\(await saveEdits\(\)\)/);
    assert.match(client, /let isUploading\s*=\s*false/);
    assert.match(client, /let isDeleting\s*=\s*false/);
    assert.match(client, /imageInput\.disabled\s*=\s*true/);
    assert.match(client, /deleteButton\.disabled\s*=\s*true/);
    assert.match(client, /!dirty && !isSaving && !isCreating && !isUploading && !isDeleting/);
  }
});

test('media editors prevent duplicate creates and recover controls after request failures', () => {
  for (const client of mediaEditors) {
    assert.match(client, /if \(isCreating\) return/);
    assert.match(client, /createButton\.disabled = true/);
    assert.match(client, /if \(!data\.item\?\.id\) throw new Error\('创建结果无效'\)/);
    assert.match(client, /createButton\.disabled = false/);
  }
});

test('media editors use the standard save shortcut', () => {
  for (const client of mediaEditors) {
    assert.match(client, /event\.ctrlKey \|\| event\.metaKey/);
    assert.match(client, /\(editForm \|\| createForm\)\?\.requestSubmit\(\)/);
  }
});

test('topic editor uses the standard save shortcut and locks deletion against saves', () => {
  const client = editors.find((editor) => editor.saveHook === 'data-save-topic').client;
  assert.match(client, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(client, /form\?\.requestSubmit\(\)/);
  assert.match(client, /if \(isSaving \|\| isDeleting\) return/);
  assert.match(client, /deleteTopicButton\.disabled = true/);
  assert.match(client, /finally \{\s*isDeleting = false/);
  assert.match(client, /!state\.dirty && !isSaving && !isDeleting && postsSavePending === 0/);
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

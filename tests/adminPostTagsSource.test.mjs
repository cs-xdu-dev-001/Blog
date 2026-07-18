import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('post editor exposes tags as a creatable multi-select field beside metadata', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');
  const client = read('public/admin-post-editor.js');
  const updateApi = read('src/pages/api/admin/posts/[id].ts');
  const createApi = read('src/pages/api/admin/posts/index.ts');
  const tagApi = read('src/pages/api/admin/posts/tags.ts');

  assert.match(page, /URL别名/);
  assert.doesNotMatch(page, />Slug</);
  assert.match(page, /data-tag-picker/);
  assert.match(page, /data-tag-summary/);
  assert.match(page, /data-tag-popover/);
  assert.match(page, /data-tag-input/);
  assert.match(page, /data-tag-options/);
  assert.match(page, /postRepository\.listTags/);
  assert.match(client, /selectedTags/);
  assert.match(client, /addTag/);
  assert.match(client, /removeTag/);
  assert.match(client, /deleteGlobalTag/);
  assert.match(client, /data-tag-toggle/);
  assert.match(client, /data-tag-remove/);
  assert.match(client, /data-tag-delete/);
  assert.match(client, /toggleTagPicker/);
  assert.match(client, /getAll\('tags'\)/);
  assert.match(updateApi, /tags:\s*body\.tags/);
  assert.match(createApi, /tags:\s*input\.tags/);
  assert.match(tagApi, /postRepository\.deleteTag/);
});

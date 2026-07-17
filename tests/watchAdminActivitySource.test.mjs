import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('watch admin exposes activity filters and dedicated editing fields', () => {
  const adminPage = fs.readFileSync(new URL('../src/pages/admin/watch.astro', import.meta.url), 'utf8');
  const editorPage = fs.readFileSync(new URL('../src/pages/admin/watch/[id]/edit.astro', import.meta.url), 'utf8');
  const editorClient = fs.readFileSync(new URL('../public/admin-watch-editor.js', import.meta.url), 'utf8');
  const updateApi = fs.readFileSync(new URL('../src/pages/api/admin/watch/[id].ts', import.meta.url), 'utf8');

  assert.match(adminPage, /data-filter="watching"/);
  assert.match(adminPage, /data-filter="activity"/);
  assert.doesNotMatch(adminPage, /缺图|缺影评|缺佳句/);
  assert.match(editorPage, /<option[^>]*>在看<\/option>/);
  assert.match(editorPage, /name="progress_text"/);
  assert.match(editorPage, /name="completed_at"/);
  assert.match(editorPage, /name="is_activity_featured"/);
  assert.match(editorPage, /个人影评/);
  assert.match(editorPage, /支持Markdown/);
  assert.match(editorClient, /comment:\s*values\.get\('comment'\)/);
  assert.match(editorClient, /progress_text:\s*values\.get\('progress_text'\)/);
  assert.match(editorClient, /completed_at:\s*values\.get\('completed_at'\)/);
  assert.match(editorClient, /is_activity_featured:\s*values\.get\('is_activity_featured'\) === 'on'/);
  assert.match(updateApi, /progress_text: String\(body\.progress_text \|\| ''\)/);
  assert.match(updateApi, /completed_at: String\(body\.completed_at \|\| ''\)/);
  assert.match(updateApi, /is_activity_featured: Boolean\(body\.is_activity_featured\)/);
});

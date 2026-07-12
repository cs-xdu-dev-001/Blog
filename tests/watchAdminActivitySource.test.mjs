import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('watch admin exposes activity status, fields, filters, and api payload', () => {
  const adminPage = fs.readFileSync(new URL('../src/pages/admin/watch.astro', import.meta.url), 'utf8');
  const adminClient = fs.readFileSync(new URL('../public/admin-watch.js', import.meta.url), 'utf8');
  const updateApi = fs.readFileSync(new URL('../src/pages/api/admin/watch/[id].ts', import.meta.url), 'utf8');

  assert.match(adminPage, /data-filter="watching"/);
  assert.match(adminPage, /data-filter="activity"/);
  assert.match(adminClient, /<option[^>]*>在看<\/option>/);
  assert.match(adminClient, /name="progress_text"/);
  assert.match(adminClient, /name="completed_at"/);
  assert.match(adminClient, /name="is_activity_featured"/);
  assert.match(adminClient, /progress_text: form\.get\('progress_text'\)/);
  assert.match(adminClient, /completed_at: form\.get\('completed_at'\)/);
  assert.match(adminClient, /is_activity_featured: form\.get\('is_activity_featured'\) === 'on'/);
  assert.match(updateApi, /progress_text: String\(body\.progress_text \|\| ''\)/);
  assert.match(updateApi, /completed_at: String\(body\.completed_at \|\| ''\)/);
  assert.match(updateApi, /is_activity_featured: Boolean\(body\.is_activity_featured\)/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const page = fs.readFileSync(new URL('../src/pages/admin/watch.astro', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../public/admin-watch.js', import.meta.url), 'utf8');

test('watch index cancels stale filtering requests without clearing the current list', () => {
  assert.match(client, /loadController\?\.abort\(\)/);
  assert.match(client, /signal:\s*controller\.signal/);
  assert.match(client, /if \(loadController !== controller\) return/);
  assert.match(client, /error\?\.name === 'AbortError'/);
  assert.match(client, /listEl\.setAttribute\('aria-busy', 'true'\)/);
  assert.doesNotMatch(client, /listEl\.innerHTML = '<div class="cms-index-error">/);
});

test('watch index exposes an in-place retry after a real load failure', () => {
  assert.match(page, /data-watch-error/);
  assert.match(page, /data-watch-retry/);
  assert.match(client, /data-watch-retry/);
  assert.match(client, /errorEl\.hidden = false/);
});

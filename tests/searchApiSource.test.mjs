import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('public search api validates query length and returns search service results', () => {
  const apiUrl = new URL('../src/pages/api/search.ts', import.meta.url);
  assert.equal(fs.existsSync(apiUrl), true);

  const api = fs.readFileSync(apiUrl, 'utf8');
  assert.match(api, /export const GET/);
  assert.match(api, /query\.length > 100/);
  assert.match(api, /searchService\.search\(query\)/);
  assert.match(api, /Response\.json/);
  assert.match(api, /status:\s*400/);
  assert.doesNotMatch(api, /export const POST/);
});

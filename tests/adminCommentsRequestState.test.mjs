import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-comments.js', import.meta.url), 'utf8');

test('comment avatars decode asynchronously without shifting their fixed row slot', () => {
  assert.match(client, /width="42" height="42" loading="lazy" decoding="async"/);
});

test('comment refresh preserves current rows and exposes request progress', () => {
  assert.match(client, /listEl\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(client, /listEl\.removeAttribute\('aria-busy'\)/);
  assert.match(client, /refreshButton\.disabled = true/);
  assert.match(client, /refreshButton\.disabled = false/);
  assert.doesNotMatch(client, /function showError[\s\S]*?listEl\.innerHTML = ''/);
  assert.match(client, /force \? '\/api\/admin\/comments\?refresh=1' : '\/api\/admin\/comments'/);
});

test('successful comment deletion updates the local list without refetching GitHub', () => {
  assert.match(client, /state\.items = state\.items\.filter\(\(item\) => item\.id !== id\)/);
  assert.match(client, /state\.items = state\.items\.filter[\s\S]*?render\(\)/);
  assert.doesNotMatch(client, /await loadComments\(\)/);
});

test('comment deletion restores its control after network and API failures', () => {
  assert.match(client, /if \(!response\.ok\) throw new Error\(data\.error \|\| '留言删除失败'\)/);
  assert.match(client, /catch \(error\)[\s\S]*?errorEl\.hidden = false/);
  assert.match(client, /finally \{\s*button\.disabled = false/);
});

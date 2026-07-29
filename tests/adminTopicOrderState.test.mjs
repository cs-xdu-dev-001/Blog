import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-topics.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/admin/topics.astro', import.meta.url), 'utf8');

test('topic ordering locks controls and always releases its request state', () => {
  assert.match(client, /const orderLocked = state\.savingOrder \|\| Boolean\(state\.query\.trim\(\)\)/);
  assert.match(client, /state\.savingOrder = true;\s*render\(\)/);
  assert.match(client, /finally \{\s*state\.savingOrder = false;\s*render\(\)/);
});

test('topic ordering restores the previous local order after a failed save', () => {
  assert.match(client, /const previousItems = \[\.\.\.state\.items\]/);
  assert.match(client, /async function saveOrder\(previousItems\)/);
  assert.match(client, /catch \(error\) \{\s*state\.items = previousItems;\s*throw error/);
  assert.doesNotMatch(client, /loadItems\(\)\.catch\(\(\) => \{\}\)/);
});

test('topic ordering validates both site config requests', () => {
  assert.match(client, /if \(!currentResponse\.ok\) throw new Error\('读取站点配置失败'\)/);
  assert.match(client, /if \(!response\.ok\) throw new Error\('保存排序失败'\)/);
});

test('topic index cancels stale loads and offers an in-place retry', () => {
  assert.match(client, /loadController\?\.abort\(\)/);
  assert.match(client, /signal:\s*controller\.signal/);
  assert.match(client, /if \(loadController !== controller\) return/);
  assert.match(client, /error\?\.name === 'AbortError'/);
  assert.match(client, /listEl\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(client, /data-topic-retry/);
  assert.match(page, /data-topic-error/);
  assert.match(page, /data-topic-retry/);
  assert.doesNotMatch(client, /listEl\.innerHTML = '<div class="cms-index-error">/);
});

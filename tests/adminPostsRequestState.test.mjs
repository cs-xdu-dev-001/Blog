import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-posts.js', import.meta.url), 'utf8');

test('admin post index ignores stale requests and keeps its current list while refreshing', () => {
  assert.match(client, /itemsController\?\.abort\(\)/);
  assert.match(client, /signal:\s*controller\.signal/);
  assert.match(client, /requestId !== itemsRequestId/);
  assert.match(client, /error\?\.name === 'AbortError'/);
  assert.match(client, /listEl\.setAttribute\('aria-busy', 'true'\)/);
  assert.doesNotMatch(client, /listEl\.innerHTML = ['"]正在读取/);
});

test('topic names rerender after the independent topic request completes', () => {
  assert.match(client, /topicSelect\.value = state\.topicSlug;\s*renderList\(\);/);
  assert.match(client, /loadTopics\(\)\.catch/);
  assert.match(client, /loadItems\(\);/);
  assert.doesNotMatch(client, /Promise\.all\(\[loadTopics\(\), loadItems\(\)\]\)/);
});

test('post creation is single-flight and recovers after a failed request', () => {
  assert.match(client, /if \(creatingPost\) return/);
  assert.match(client, /createButtons\.forEach\(\(button\) => \{ button\.disabled = true; \}\)/);
  assert.match(client, /if \(!data\.item\?\.id\) throw new Error\('创建结果无效'\)/);
  assert.match(client, /creatingPost = false/);
  assert.match(client, /button\.disabled = false/);
});

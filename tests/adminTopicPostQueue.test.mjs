import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const client = fs.readFileSync(new URL('../public/admin-topic-editor.js', import.meta.url), 'utf8');

test('topic-post mutations are serialized using immutable id snapshots', () => {
  assert.match(client, /let postsSaveQueue = Promise\.resolve\(\)/);
  assert.match(client, /const postIds = state\.linked\.map\(\(post\) => post\.id\)/);
  assert.match(client, /postsSaveQueue = postsSaveQueue\s*\.catch\(\(\) => \{\}\)\s*\.then\(async \(\) =>/);
  assert.match(client, /body: JSON\.stringify\(\{ postIds \}\)/);
});

test('only the latest topic-post response may replace local state', () => {
  assert.match(client, /const version = \+\+postsChangeVersion/);
  assert.match(client, /if \(version !== postsChangeVersion\) return/);
  assert.match(client, /if \(version === postsChangeVersion\) setStatus/);
  assert.match(client, /setStatus\(state\.dirty \? '关联已保存，资料仍有更改' : '关联已保存'/);
});

test('pending topic-post saves participate in navigation and delete protection', () => {
  assert.match(client, /postsSavePending \+= 1/);
  assert.match(client, /postsSavePending = Math\.max\(0, postsSavePending - 1\)/);
  assert.match(client, /if \(postsSavePending > 0\) return setStatus\('关联仍在保存，请稍候'/);
  assert.match(client, /if \(!state\.dirty && !isSaving && !isDeleting && postsSavePending === 0\) return/);
});

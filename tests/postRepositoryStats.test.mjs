import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const repository = fs.readFileSync(new URL('../src/lib/server/postRepository.mjs', import.meta.url), 'utf8');
const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

test('post statistics use one aggregate query', () => {
  const statsSource = repository.match(/stats\(\) \{([\s\S]*?)\n    \},\n\n    update/)?.[1] || '';
  assert.match(statsSource, /COUNT\(\*\) AS total/);
  assert.match(statsSource, /SUM\(CASE WHEN published = 1/);
  assert.match(statsSource, /SUM\(CASE WHEN published = 0/);
  assert.match(statsSource, /SUM\(CASE WHEN featured = 1/);
  assert.equal((statsSource.match(/db\.prepare\(/g) || []).length, 1);
});

test('homepage uses the exact published post count instead of a capped list', () => {
  assert.match(homepage, /const postStats = postRepository\.stats\(\)/);
  assert.match(homepage, /const publishedPostCount = postStats\.published/);
  assert.doesNotMatch(homepage, /posts\.length/);
});

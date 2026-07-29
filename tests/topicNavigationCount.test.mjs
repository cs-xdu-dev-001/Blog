import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const about = fs.readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');
const repository = fs.readFileSync(new URL('../src/lib/server/siteConfigRepository.mjs', import.meta.url), 'utf8');

test('主线导航角标使用当前主线数量', () => {
  assert.match(homepage, /const topicCount = topicCards\.length;/);
  assert.match(homepage, /<small>\{topicCount\}<\/small>/);
  assert.match(about, /const topicCount = siteConfig\.topics\?\.cards\?\.length \?\? 0;/);
  assert.match(about, /<small>\{topicCount\}<\/small>/);
});

test('主线默认角标不再写死为4', () => {
  assert.match(
    repository,
    /\{ key: 'topics',[^\n]+navSmall: 'auto'/,
  );
});

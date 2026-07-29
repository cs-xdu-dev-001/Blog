import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const routes = [
  ['src/pages/posts/[slug].astro', '/posts/${post.slug}'],
  ['src/pages/reading/[slug].astro', '/reading/${book.slug}'],
  ['src/pages/watch/[id].astro', '/watch/${item.id}'],
  ['src/pages/food/[id].astro', '/food/${item.id}'],
  ['src/pages/topics/[slug].astro', '/topics/${topic.slug}'],
];

test('detail pages render compact backlinks from the shared reference service', async () => {
  for (const [file, target] of routes) {
    const source = await readFile(file, 'utf8');
    assert.match(source, /ContentBacklinks/);
    assert.match(source, /contentReferenceService\.backlinks/);
    assert.ok(source.includes(target), `${file} should use its canonical target URL`);
  }
});

test('backlink component stays absent when there are no references', async () => {
  const source = await readFile('src/components/ContentBacklinks.astro', 'utf8');
  assert.match(source, /items\.length > 0/);
  assert.match(source, /相关笔记/);
});

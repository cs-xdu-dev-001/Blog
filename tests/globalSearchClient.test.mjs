import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  escapeSearchHtml,
  flattenSearchItems,
  safeSearchHref,
} from '../public/global-search-core.mjs';

test('search client escapes result text and accepts only local paths', () => {
  assert.equal(escapeSearchHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(safeSearchHref('/posts/rag'), '/posts/rag');
  assert.equal(safeSearchHref('//evil.example/path'), '');
  assert.equal(safeSearchHref('javascript:alert(1)'), '');
  assert.equal(safeSearchHref('https://example.com'), '');
});

test('search client flattens top-level groups without mixing tag children into navigation', () => {
  const items = flattenSearchItems([
    { key: 'posts', label: '笔记', items: [{ id: 'post:1', title: 'A' }] },
    { key: 'tags', label: '标签', items: [{ id: 'tag:ai', title: 'AI', children: [{ id: 'post:2', title: 'B' }] }] },
  ]);

  assert.deepEqual(items.map((item) => item.id), ['post:1', 'tag:ai']);
  assert.equal(items[0].groupKey, 'posts');
  assert.equal(items[1].groupLabel, '标签');
});

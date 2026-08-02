import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const pagesUsingBaseLayout = [
  'src/pages/about.astro',
  'src/pages/food.astro',
  'src/pages/watch/[id].astro',
  'src/pages/food/[id].astro',
  'src/pages/admin/login.astro',
  'src/pages/admin/posts/[id]/edit.astro',
];

test('pages rendered inside BaseLayout do not add a second main landmark', () => {
  for (const relativePath of pagesUsingBaseLayout) {
    const source = fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /<\/?main(?:\s|>)/, relativePath);
  }
});

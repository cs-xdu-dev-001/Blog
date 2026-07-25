import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('food module exposes a complete admin CRUD flow', () => {
  const layout = read('../src/layouts/AdminLayout.astro');
  const index = read('../src/pages/admin/food.astro');
  const create = read('../src/pages/admin/food/new.astro');
  const edit = read('../src/pages/admin/food/[id]/edit.astro');
  const client = read('../public/admin-food-editor.js');
  const api = read('../src/pages/api/admin/food/[id].ts');

  assert.match(layout, /href:\s*'\/admin\/food'/);
  assert.match(index, /href="\/admin\/food\/new"/);
  assert.match(create, /data-food-create-form/);
  assert.match(edit, /name="published"[^>]*checked=\{Boolean\(item\.published\)\}/);
  assert.match(edit, /name="is_featured"[^>]*checked=\{Boolean\(item\.is_featured\)\}/);
  assert.match(client, /\/api\/admin\/food/);
  assert.match(client, /data-food-image/);
  assert.match(api, /published:\s*body\.published\s*==\s*null/);
});

test('food module is visible on the homepage and has public archive routes', () => {
  const homepage = read('../src/pages/index.astro');
  const archive = read('../src/pages/food.astro');
  const detail = read('../src/pages/food/[id].astro');
  const sitemap = read('../src/pages/sitemap.xml.ts');
  const sections = read('../src/lib/server/siteConfigRepository.mjs');

  assert.match(homepage, /id="food"/);
  assert.match(homepage, /data-food-filter/);
  assert.match(homepage, /href="\/food"/);
  assert.match(homepage, /foodRepository\.list/);
  assert.match(archive, /publishedOnly:\s*true/);
  assert.match(detail, /foodRepository\.getPublic/);
  assert.match(sitemap, /foodRepository/);
  assert.match(sections, /key:\s*'food'/);
});

test('homepage keeps the food entry visible before the first public record', () => {
  const homepage = read('../src/pages/index.astro');

  assert.doesNotMatch(
    homepage,
    /isSectionEnabled\('food'\)\s*&&\s*foodItems\.length\s*>\s*0/,
  );
  assert.match(homepage, /还没有公开的美食记录/);
});

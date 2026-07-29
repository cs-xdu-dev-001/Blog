import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('admin page redirects are handled by middleware before layouts render', () => {
  const middleware = fs.readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
  const adminLayout = fs.readFileSync(new URL('../src/layouts/AdminLayout.astro', import.meta.url), 'utf8');

  assert.match(middleware, /defineMiddleware/);
  assert.match(middleware, /isPathWithin\(pathname, '\/admin'\)/);
  assert.match(middleware, /pathname === root \|\| pathname\.startsWith\(`\$\{root\}\/`\)/);
  assert.match(middleware, /pathname !== '\/admin\/login'/);
  assert.match(middleware, /context\.redirect\('\/admin\/login'\)/);
  assert.doesNotMatch(adminLayout, /Astro\.redirect\('\/admin\/login'\)/);
  assert.doesNotMatch(adminLayout, /requireAdmin\(Astro\)/);
});

test('admin pages and APIs explicitly disable shared and browser caching', () => {
  const middleware = fs.readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
  assert.match(middleware, /isPathWithin\(pathname, '\/admin'\)/);
  assert.match(middleware, /isPathWithin\(pathname, '\/api\/admin'\)/);
  assert.match(middleware, /Cache-Control', 'private, no-store, max-age=0'/);
  assert.match(middleware, /Pragma', 'no-cache'/);
  assert.match(middleware, /isAdminSurface \? preventPrivateCaching\(response\) : response/);
});

test('admin root redirects to the post management entry', () => {
  const adminIndex = fs.readFileSync(new URL('../src/pages/admin/index.astro', import.meta.url), 'utf8');

  assert.match(adminIndex, /Astro\.redirect\('\/admin\/posts'\)/);
});

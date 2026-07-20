import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public post page renders locked posts through an unlock branch', () => {
  const page = read('src/pages/posts/[slug].astro');

  assert.match(page, /post\.locked/);
  assert.match(page, /getLockedNoteCookieName/);
  assert.match(page, /readLockedNoteKeyFromCookie/);
  assert.match(page, /data-locked-post-unlock/);
  assert.match(page, /postToRender\.body/);
});

test('public feeds and assistant sources skip locked note bodies', () => {
  const rssRoute = read('src/pages/rss.xml.ts');
  const sitemapRoute = read('src/pages/sitemap.xml.ts');
  const assistantService = read('src/lib/server/assistantService.mjs');
  const searchService = read('src/lib/server/searchService.mjs');

  assert.match(rssRoute, /filter\(\(post\)\s*=>\s*!post\.locked\)/);
  assert.match(sitemapRoute, /filter\(\(post\)\s*=>\s*!post\.locked\)/);
  assert.match(assistantService, /if\s*\(post\.locked\)\s*return/);
  assert.match(searchService, /item\.locked\s*\?/);
});

test('admin post editor exposes WordPress-style protected note controls', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');
  const client = read('public/admin-post-editor.js');
  const updateApi = read('src/pages/api/admin/posts/[id].ts');
  const createApi = read('src/pages/api/admin/posts/index.ts');

  assert.match(page, /name="visibility"/);
  assert.match(page, /data-locked-note-key/);
  assert.match(page, /data-unlock-locked-post/);
  assert.match(client, /visibility:\s*data\.get\('visibility'\)/);
  assert.match(client, /lockedNoteKey:\s*data\.get\('lockedNoteKey'\)/);
  assert.match(client, /\/api\/admin\/posts\/\$\{post\.id\}\/unlock/);
  assert.match(updateApi, /visibility:\s*body\.visibility/);
  assert.match(updateApi, /lockedNoteKey:\s*body\.lockedNoteKey/);
  assert.match(createApi, /visibility:\s*input\.visibility/);
  assert.match(createApi, /lockedNoteKey:\s*input\.lockedNoteKey/);
});

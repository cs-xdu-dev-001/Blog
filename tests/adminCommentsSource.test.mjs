import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : '';
}

test('admin shell exposes a dedicated comment management index', () => {
  const layout = read('src/layouts/AdminLayout.astro');
  const page = read('src/pages/admin/comments.astro');
  const script = read('public/admin-comments.js');

  assert.match(layout, /key: 'comments'.*href: '\/admin\/comments'/);
  assert.match(page, /active="comments"/);
  assert.match(page, /data-comments-admin/);
  assert.match(page, /data-comments-list/);
  assert.match(page, /\/admin-comments\.js/);
  assert.match(script, /fetch\('\/api\/admin\/comments'/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.match(script, /encodeURIComponent\(id\)/);
  assert.match(script, /window\.confirm/);
  assert.match(script, /escapeHtml/);
});

test('admin comment APIs require an admin session and keep GitHub access server-side', () => {
  const indexApi = read('src/pages/api/admin/comments/index.ts');
  const itemApi = read('src/pages/api/admin/comments/[id].ts');
  const envExample = read('.env.example');

  assert.match(indexApi, /requireAdmin/);
  assert.match(indexApi, /githubCommentsService\.listComments/);
  assert.match(itemApi, /requireAdmin/);
  assert.match(itemApi, /githubCommentsService\.deleteComment/);
  assert.match(envExample, /GITHUB_DISCUSSIONS_TOKEN=/);
  assert.doesNotMatch(indexApi + itemApi, /process\.env\.GITHUB_DISCUSSIONS_TOKEN/);
});

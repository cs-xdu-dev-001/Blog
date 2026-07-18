import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('admin post editor previews through the frontend markdown renderer', () => {
  const page = read('src/pages/admin/posts/[id]/edit.astro');
  const client = read('public/admin-post-editor.js');
  const apiUrl = new URL('../src/pages/api/admin/posts/preview.ts', import.meta.url);
  const api = fs.existsSync(apiUrl) ? fs.readFileSync(apiUrl, 'utf8') : '';

  assert.match(page, /post-editor-preview article-prose/);
  assert.equal(fs.existsSync(apiUrl), true);
  assert.match(api, /markdownToHtml/);
  assert.match(client, /\/api\/admin\/posts\/preview/);
  assert.match(client, /previewRequestId/);
});

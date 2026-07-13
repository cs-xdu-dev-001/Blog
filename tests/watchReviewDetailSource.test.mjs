import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('watch detail page renders a markdown review from an existing archive item', () => {
  const pageUrl = new URL('../src/pages/watch/[id].astro', import.meta.url);
  assert.equal(fs.existsSync(pageUrl), true);

  const page = fs.readFileSync(pageUrl, 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  assert.match(page, /watchRepository\.get\(id\)/);
  assert.match(page, /status:\s*404/);
  assert.match(page, /markdownToHtml\(item\.comment/);
  assert.match(page, /href="\/#watch"/);
  assert.match(page, /item\.quote &&/);
  assert.match(page, /item\.comment &&/);
  assert.match(page, /set:html=\{review\.html\}/);
  assert.doesNotMatch(page, /暂无影评|等待补充/);
  assert.match(styles, /\.watch-review-shell\s*\{/);
});

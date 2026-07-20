import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('homepage omits decorative eyebrows and explanatory copy', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../public/admin-site.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  assert.doesNotMatch(homepage, /section\('[^']+', \{ eyebrow:/);
  assert.doesNotMatch(homepage, /书架里放的是正在读/);
  assert.doesNotMatch(homepage, /这不是精确计时/);
  assert.doesNotMatch(homepage, /这里放我去过的城市/);
  assert.doesNotMatch(homepage, /我看过的影视作品统计/);
  assert.doesNotMatch(homepage, /当前博客主线和实践记录的权重/);
  assert.doesNotMatch(styles, /这是我的旅行足迹/);
  assert.doesNotMatch(admin, /section\.\$\{section\.key\}\.eyebrow/);
});

test('homepage keeps the writing entry but omits the duplicate note index section', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(homepage, /href="\/writing"/);
  assert.doesNotMatch(homepage, /id="notes"|qzq-notes-section|qzq-notes-panel/);
  assert.doesNotMatch(homepage, /const featured\s*=|const highlightPosts\s*=/);
});

test('homepage hero keeps the original orange dev notes plate', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  assert.match(homepage, /aria-label="Dev Notes"/);
  assert.match(homepage, /data-text="Dev"/);
  assert.match(homepage, /data-text="Notes"/);
  assert.match(homepage, /Public field notes/);
  assert.doesNotMatch(homepage, /aria-label="笔记索引"|data-text="笔记"|主线笔记/);
  assert.match(styles, /\.qzq-wordmark-card h1\s*\{[^}]*color:\s*#e8751a/s);
  assert.match(styles, /\.qzq-wordmark-card h1\s*\{[^}]*text-transform:\s*uppercase/s);
});

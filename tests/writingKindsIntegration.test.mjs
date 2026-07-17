import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const writingPage = fs.readFileSync(new URL('../src/pages/writing.astro', import.meta.url), 'utf8');
const editorPage = fs.readFileSync(new URL('../src/pages/admin/posts/[id]/edit.astro', import.meta.url), 'utf8');
const adminPage = fs.readFileSync(new URL('../src/pages/admin/posts.astro', import.meta.url), 'utf8');
const adminClient = fs.readFileSync(new URL('../public/admin-posts.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('writing index filters technical notes and reflections in place', () => {
  assert.match(writingPage, /data-writing-filter="all"/);
  assert.match(writingPage, /data-writing-filter="technical"/);
  assert.match(writingPage, /data-writing-filter="reflection"/);
  assert.match(writingPage, /data-writing-kind=/);
  assert.match(writingPage, /data-writing-count/);
  assert.match(writingPage, /history\.replaceState/);
  assert.match(writingPage, /prefers-reduced-motion: reduce/);
  assert.match(writingPage, /applyWritingFilter\(filterFromUrl\(\), \{ updateUrl: false, animate: false \}\)/);
  assert.match(styles, /\.writing-filter\s*\{/);
  assert.match(styles, /\.writing-filter-button\.is-active/);
  assert.match(styles, /\.writing-row\[hidden\]/);
});

test('admin can create and edit reflection posts without a separate module', () => {
  assert.match(editorPage, /'随记'/);
  assert.match(adminPage, /data-post-category="随记"/);
  assert.match(adminPage, /data-post-kind-filter="all"/);
  assert.match(adminPage, /data-post-kind-filter="technical"/);
  assert.match(adminPage, /data-post-kind-filter="reflection"/);
  assert.match(adminClient, /querySelectorAll\('\[data-create-post\]'\)/);
  assert.match(adminClient, /button\.dataset\.postCategory/);
  assert.match(adminClient, /category === '随记'/);
  assert.match(adminClient, /kind:\s*'all'/);
  assert.match(adminClient, /state\.kind === 'reflection'/);
  assert.match(adminClient, /data-post-kind-filter/);
  assert.match(styles, /\.cms-kind-filters\s*\{/);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { allStyles as styles } from './helpers/styleSources.mjs';

const writingPage = fs.readFileSync(new URL('../src/pages/writing.astro', import.meta.url), 'utf8');
const editorPage = fs.readFileSync(new URL('../src/pages/admin/posts/[id]/edit.astro', import.meta.url), 'utf8');
const adminPage = fs.readFileSync(new URL('../src/pages/admin/posts.astro', import.meta.url), 'utf8');
const adminClient = fs.readFileSync(new URL('../public/admin-posts.js', import.meta.url), 'utf8');

test('writing index filters technical notes and reflections in place', () => {
  assert.match(writingPage, /data-writing-filter="all"/);
  assert.match(writingPage, /data-writing-filter="technical"/);
  assert.match(writingPage, /data-writing-filter="reflection"/);
  assert.match(writingPage, /data-writing-filter="algorithm"/);
  assert.match(writingPage, /data-writing-kind=/);
  assert.match(writingPage, /data-writing-algorithm=/);
  assert.match(writingPage, /post\.topicSlugs/);
  assert.match(writingPage, /post\.kind/);
  assert.doesNotMatch(writingPage, /writingKind\(post\.data\.category\)/);
  assert.match(writingPage, /data-writing-count/);
  assert.match(writingPage, /history\.replaceState/);
  assert.match(writingPage, /prefers-reduced-motion: reduce/);
  assert.match(writingPage, /applyWritingFilter\(filterFromUrl\(\), \{ updateUrl: false, animate: false \}\)/);
  assert.match(writingPage, /syncEmptyState/);
  assert.match(styles, /\.writing-filter\s*\{/);
  assert.match(styles, /\.writing-filter-button\.is-active/);
  assert.match(styles, /\.writing-row\[hidden\]/);
});

test('admin can create and edit reflection posts without a separate module', () => {
  assert.match(editorPage, /name="kind"/);
  assert.match(editorPage, /value="technical"/);
  assert.match(editorPage, /value="reflection"/);
  assert.doesNotMatch(editorPage, /name="category"/);
  assert.doesNotMatch(editorPage, /categoryOptions/);
  assert.match(adminPage, /data-post-kind="reflection"/);
  assert.match(adminPage, /data-post-kind="technical"/);
  assert.match(adminPage, /data-post-kind-filter/);
  assert.match(adminPage, /<option value="all">/);
  assert.match(adminPage, /<option value="technical">/);
  assert.match(adminPage, /<option value="reflection">/);
  assert.match(adminClient, /querySelectorAll\('\[data-create-post\]'\)/);
  assert.match(adminClient, /button\.dataset\.postKind/);
  assert.doesNotMatch(adminClient, /item\.category === '随记'/);
  assert.match(adminClient, /kind:\s*'all'/);
  assert.match(adminClient, /new URLSearchParams\(\{ filter: state\.filter, query: state\.query, kind: state\.kind \}\)/);
  assert.match(adminClient, /pagination\.reset\(\)/);
  assert.match(adminClient, /kindSelect\.value/);
  assert.match(styles, /\.cms-index-toolbar select/);
});

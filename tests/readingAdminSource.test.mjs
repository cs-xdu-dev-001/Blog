import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const page = fs.readFileSync(new URL('../src/pages/admin/reading.astro', import.meta.url), 'utf8');
const newPage = fs.readFileSync(new URL('../src/pages/admin/reading/new.astro', import.meta.url), 'utf8');
const editPage = fs.readFileSync(new URL('../src/pages/admin/reading/[id]/edit.astro', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../public/admin-reading.js', import.meta.url), 'utf8');
const editorClient = fs.readFileSync(new URL('../public/admin-reading-editor.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

test('reading admin uses a compact index and dedicated editors', () => {
  assert.match(page, /cms-index-shell/);
  assert.match(page, /data-reading-retry/);
  assert.match(page, /href="\/admin\/reading\/new"/);
  assert.doesNotMatch(page, /cms-hero|缺封面|完整度/);
  assert.match(newPage, /data-reading-create-page/);
  assert.match(editPage, /data-reading-editor-page/);
  assert.match(styles, /\.cms-index-shell\s*\{/);
});

test('reading admin keeps retry, create, upload, save, and delete flows', () => {
  assert.match(client, /EMPTY_STATS/);
  assert.match(client, /showLoadError/);
  assert.match(client, /data-reading-retry/);
  assert.match(editorClient, /\/api\/admin\/reading/);
  assert.match(editorClient, /data-reading-image/);
  assert.match(editorClient, /method:\s*'PUT'/);
  assert.match(editorClient, /method:\s*'DELETE'/);
});

test('reading admin keeps core text readable', () => {
  assert.match(styles, /--cms-font-size-base:\s*15px/);
  assert.match(styles, /\.cms-index-title\s*\{[^}]*font-size:\s*16px/);
  assert.match(styles, /\.cms-field,[\s\S]*?font-size:\s*15px/);
});

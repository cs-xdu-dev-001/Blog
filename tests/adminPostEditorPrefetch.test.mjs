import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/scripts/admin-post-editor-prefetch.js', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/pages/admin/posts.astro', import.meta.url), 'utf8');

test('post index prefetches the editor only after edit intent', () => {
  assert.match(page, /admin-post-editor-prefetch\.js/);
  assert.match(source, /import\('\.\/admin-post-milkdown\.js'\)/);
  assert.match(source, /pointerover/);
  assert.match(source, /focusin/);
  assert.match(source, /saveData/);
  assert.match(source, /effectiveType/);
  assert.match(source, /request\?\.catch/);
  assert.match(source, /editorModulePromise = null/);
  assert.doesNotMatch(source, /requestIdleCallback|idlePrefetch|setTimeout\(idlePrefetch/);
});

test('editor loader clears a rejected module before retrying', () => {
  const loader = fs.readFileSync(new URL('../src/scripts/admin-post-milkdown-loader.js', import.meta.url), 'utf8');
  assert.match(loader, /\.catch\(\(error\) => \{[\s\S]*editorModulePromise = null[\s\S]*activateFallback\(error\)/);
});

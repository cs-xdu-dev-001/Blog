import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('all homepage watch cards expose double click and keyboard detail navigation', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.ok((homepage.match(/data-watch-detail/g) || []).length >= 3);
  assert.match(homepage, /data-href=\{watchArchive\.activity\.watching\.href\}/);
  assert.match(homepage, /data-href=\{watchArchive\.activity\.finished\.href\}/);
  assert.match(homepage, /data-href=\{item\.href\}/);
  assert.doesNotMatch(homepage, /querySelectorAll\('\[data-watch-detail\]'\)\.forEach/);
  assert.match(homepage, /watchSection\?\.addEventListener\('dblclick'/);
  assert.match(homepage, /watchCardFromEvent/);
  assert.match(homepage, /event\.key !== 'Enter'/);
  assert.match(homepage, /event\.key !== ' '/);
});

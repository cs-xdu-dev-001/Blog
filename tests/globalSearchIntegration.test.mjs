import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('all public navigation variants open the single global search component', () => {
  const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  const header = fs.readFileSync(new URL('../src/components/Header.astro', import.meta.url), 'utf8');
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const about = fs.readFileSync(new URL('../src/pages/about.astro', import.meta.url), 'utf8');

  assert.match(layout, /import GlobalSearch/);
  assert.equal((layout.match(/<GlobalSearch\s*\/>/g) || []).length, 1);
  for (const source of [header, homepage, about]) {
    assert.match(source, /data-global-search-open/);
    assert.match(source, /aria-label="打开全站搜索"/);
    assert.match(source, /<circle cx="11" cy="11" r="7"/);
  }
  assert.match(layout, /src="\/global-search\.js"/);
});

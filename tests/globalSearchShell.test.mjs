import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('global search shell provides a two-column dialog and complete keyboard interaction', () => {
  const componentUrl = new URL('../src/components/GlobalSearch.astro', import.meta.url);
  const clientUrl = new URL('../public/global-search.js', import.meta.url);
  assert.equal(fs.existsSync(componentUrl), true);
  assert.equal(fs.existsSync(clientUrl), true);

  const component = fs.readFileSync(componentUrl, 'utf8');
  const client = fs.readFileSync(clientUrl, 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  assert.match(component, /role="dialog"/);
  assert.match(component, /data-global-search-input/);
  assert.match(component, /data-global-search-results/);
  assert.match(component, /data-global-search-preview/);
  assert.match(component, /data-global-search-close/);
  assert.match(component, /data-global-search-back/);
  assert.match(client, /new AbortController\(\)/);
  assert.match(client, /setTimeout\([^,]+, 120\)/);
  assert.match(client, /ArrowUp/);
  assert.match(client, /ArrowDown/);
  assert.match(client, /ArrowLeft/);
  assert.match(client, /ArrowRight/);
  assert.match(client, /Enter/);
  assert.match(client, /Escape/);
  assert.match(client, /item\.children/);
  assert.match(client, /is-previewing/);
  assert.match(styles, /\.global-search-layout\s*\{/);
  assert.match(styles, /grid-template-columns:\s*52% 48%/);
  assert.match(styles, /\.global-search-preview-media img[\s\S]*object-fit:\s*contain/);
  assert.match(styles, /\.global-search-preview-media img\s*\{[^}]*height:\s*100%\s*!important/);
  assert.match(styles, /\.global-search-preview-media\s*\{[^}]*position:\s*relative/);
  assert.match(styles, /\.global-search-preview-media img\s*\{[^}]*position:\s*absolute/);
  assert.match(styles, /\.global-search-query\s*>\s*\.global-search-mobile-back\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(component, /Ctrl|Enter打开|方向键/);
});

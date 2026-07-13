import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

test('homepage renders symmetric activity cards before the lightweight watch marquee', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

  const activityIndex = homepage.indexOf('data-watch-activity');
  const marqueeIndex = homepage.search(/class="qzq-watch-marquee[^"']*"/);

  assert.ok(activityIndex > 0);
  assert.ok(marqueeIndex > activityIndex);
  assert.match(homepage, /watchArchive\.activity &&/);
  assert.equal((homepage.match(/\sdata-watch-activity-card(?:\s|>)/g) || []).length, 2);
  assert.match(homepage, /data-depth-poster/);
  assert.match(homepage, /aria-expanded="false"/);
  assert.match(homepage, /requestAnimationFrame/);
  assert.match(homepage, /aria-expanded/);
  assert.match(styles, /\.qzq-watch-activity\s*\{/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.qzq-watch-activity-card\.is-active/);
});

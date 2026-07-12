import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { watchImages } from '../src/data/watchImages.mjs';

test('watch activity seed keeps local covers and activity defaults', () => {
  const initScript = fs.readFileSync(new URL('../scripts/init-watch-db.mjs', import.meta.url), 'utf8');

  assert.equal(watchImages['大江大河'], '/watch/%E5%A4%A7%E6%B1%9F%E5%A4%A7%E6%B2%B3.jpg');
  assert.equal(watchImages['主角'], '/watch/%E4%B8%BB%E8%A7%92.jpg');
  assert.equal(fs.existsSync(new URL('../public/watch/大江大河.jpg', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../public/watch/主角.jpg', import.meta.url)), true);
  assert.match(initScript, /'大江大河': \{ status: '在看', is_activity_featured: 1 \}/);
  assert.match(initScript, /'主角': \{ status: '已看', is_activity_featured: 1 \}/);
  assert.match(initScript, /is_activity_featured: activity\?\.is_activity_featured \?\? 0/);
});

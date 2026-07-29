import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const clients = [
  '../public/admin-watch.js',
  '../public/admin-reading.js',
  '../public/admin-food.js',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

test('media-heavy admin indexes use native lazy thumbnails instead of eager CSS backgrounds', () => {
  clients.forEach((client) => {
    assert.match(client, /<img class=\"cms-index-thumb/);
    assert.match(client, /loading=\"lazy\"/);
    assert.match(client, /decoding=\"async\"/);
    assert.doesNotMatch(client, /background-image:url/);
  });
});

test('media-heavy admin indexes preserve current results while a replacement request is pending', () => {
  clients.forEach((client) => {
    assert.match(client, /setAttribute\('aria-busy', 'true'\)/);
    assert.match(client, /removeAttribute\('aria-busy'\)/);
    assert.doesNotMatch(client, /listEl\.innerHTML = ''/);
  });
});

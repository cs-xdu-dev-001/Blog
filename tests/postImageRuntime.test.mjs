import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { servePostImage } from '../src/lib/server/postImageResponse.mjs';

test('runtime post images are served with safe content headers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'post-image-response-'));
  const image = Buffer.from([0x52, 0x49, 0x46, 0x46]);
  fs.writeFileSync(path.join(root, 'sample.webp'), image);

  const response = await servePostImage('sample.webp', { root });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
});

test('runtime post images reject traversal and non-image files', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'post-image-boundary-'));
  const root = path.join(parent, 'posts');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(parent, 'outside.png'), Buffer.from('outside'));
  fs.writeFileSync(path.join(root, 'note.txt'), Buffer.from('text'));

  assert.equal((await servePostImage('../outside.png', { root })).status, 404);
  assert.equal((await servePostImage('note.txt', { root })).status, 404);
  assert.equal((await servePostImage('missing.webp', { root })).status, 404);
});

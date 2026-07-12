import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWatchRepository } from '../src/lib/server/watchRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-repo-create-'));
const repo = createWatchRepository({
  dbPath: path.join(tmp, 'watch.sqlite'),
  uploadDir: path.join(tmp, 'uploads'),
});

const created = repo.create({
  title: 'New Watch Item',
  type: 'Movie',
  status: 'Wanted',
});

assert.equal(created.title, 'New Watch Item');
assert.equal(created.type, 'Movie');
assert.equal(created.status, 'Wanted');
assert.equal(created.rating, '');
assert.equal(created.comment, '');
assert.equal(created.quote, '');
assert.equal(created.quote_source, '');
assert.equal(created.image_path, '');
assert.equal(created.is_featured, 0);
assert.equal(created.progress_text, '');
assert.equal(created.completed_at, '');
assert.equal(created.is_activity_featured, 0);
assert.equal(repo.stats().total, 1);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWatchRepository } from '../src/lib/server/watchRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-repo-remove-'));
const repo = createWatchRepository({
  dbPath: path.join(tmp, 'watch.sqlite'),
  uploadDir: path.join(tmp, 'uploads'),
});

const item = repo.create({
  title: 'Duplicate Watch Item',
  type: '电影',
  status: '想看',
});

assert.equal(repo.stats().total, 1);
assert.equal(repo.remove(item.id), true);
assert.equal(repo.get(item.id), null);
assert.equal(repo.stats().total, 0);
assert.equal(repo.remove(item.id), false);

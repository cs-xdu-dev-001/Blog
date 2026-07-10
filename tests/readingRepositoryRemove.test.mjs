import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReadingRepository } from '../src/lib/server/readingRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-repo-remove-'));
const repo = createReadingRepository({
  dbPath: path.join(tmp, 'reading.sqlite'),
  uploadDir: path.join(tmp, 'uploads'),
});

const item = repo.create({
  title: 'Duplicate Reading Item',
  author: 'Author',
  status: 'planned',
});

assert.equal(repo.stats().total, 1);
assert.equal(repo.remove(item.id), true);
assert.equal(repo.get(item.id), null);
assert.equal(repo.stats().total, 0);
assert.equal(repo.remove(item.id), false);

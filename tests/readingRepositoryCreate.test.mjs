import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReadingRepository } from '../src/lib/server/readingRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-repo-create-'));
const repo = createReadingRepository({
  dbPath: path.join(tmp, 'reading.sqlite'),
  uploadDir: path.join(tmp, 'uploads'),
});

repo.insertMany([
  {
    slug: 'existing-book',
    title: 'Existing Book',
    author: 'Author',
    status: 'read',
    status_label: '已读',
    progress: '已读',
    sort_order: 7,
  },
]);

const created = repo.create({
  title: 'New Reading Item',
  author: 'Author Name',
  status: 'planned',
});

assert.equal(created.title, 'New Reading Item');
assert.equal(created.author, 'Author Name');
assert.equal(created.status, 'planned');
assert.equal(created.status_label, '待读');
assert.equal(created.progress, '待读');
assert.equal(created.summary, '');
assert.equal(created.quote, '');
assert.equal(created.review, '');
assert.equal(created.image_path, '');
assert.equal(created.is_featured, 0);
assert.equal(created.sort_order, 8);
assert.ok(created.slug.startsWith('new-reading-item'));
assert.equal(repo.stats().total, 2);

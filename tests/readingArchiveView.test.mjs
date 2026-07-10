import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readingArchive } from '../src/data/readingArchive.mjs';
import { createReadingArchiveView } from '../src/lib/server/readingArchiveView.mjs';
import { createReadingRepository } from '../src/lib/server/readingRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-view-'));
const repo = createReadingRepository({
  dbPath: path.join(tmp, 'reading.sqlite'),
  uploadDir: path.join(tmp, 'uploads'),
});

const emptyView = createReadingArchiveView(repo);
assert.equal(emptyView.getFeaturedReadingFromDb().length, readingArchive.length);
assert.equal(emptyView.getReadingBySlugFromDb('the-three-body-problem')?.title, '三体');

repo.replaceAll([
  {
    slug: 'custom-book',
    title: '自定义书',
    author: '本地管理端',
    status: 'reading',
    status_label: '在读',
    progress: '10%',
    summary: '来自数据库的书籍。',
    quote: '数据库优先。',
    review: '这段内容用于验证前台读取数据库，而不是静态文件。',
    spine_color: '#111827',
    accent_color: '#f97316',
    image_path: '/uploads/reading/custom.webp',
    is_featured: 1,
    sort_order: 1,
  },
]);

const dbView = createReadingArchiveView(repo);
assert.deepEqual(dbView.getFeaturedReadingFromDb().map((book) => book.slug), ['custom-book']);
assert.equal(dbView.getReadingGroupsFromDb().reading[0].title, '自定义书');
assert.equal(dbView.getReadingBySlugFromDb('custom-book')?.cover, '/uploads/reading/custom.webp');

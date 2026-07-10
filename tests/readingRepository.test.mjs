import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createReadingRepository, safeReadingImageBaseName } from '../src/lib/server/readingRepository.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-repo-'));
const dbPath = path.join(tmp, 'reading.sqlite');
const uploadDir = path.join(tmp, 'uploads');

const repo = createReadingRepository({ dbPath, uploadDir });
repo.initialize();
repo.replaceAll([
  {
    slug: 'all-quiet-in-peking',
    title: '北平无战事',
    author: '刘和平',
    status: 'reading',
    status_label: '在读',
    progress: '在读',
    summary: '复杂时代里的选择、沉默和代价。',
    quote: '风雨如晦，鸡鸣不已。',
    review: '',
    spine_color: '#263548',
    accent_color: '#ff9138',
    image_path: '',
    is_featured: 1,
    sort_order: 1,
  },
  {
    slug: 'the-three-body-problem',
    title: '三体',
    author: '刘慈欣',
    status: 'planned',
    status_label: '待读',
    progress: '待读',
    summary: '宇宙尺度下的文明选择。',
    quote: '',
    review: '',
    spine_color: '#334155',
    accent_color: '#d9a6bb',
    image_path: '',
    is_featured: 1,
    sort_order: 2,
  },
]);

assert.equal(repo.stats().total, 2);
assert.equal(repo.stats().missingImage, 2);
assert.equal(repo.stats().missingQuote, 1);
assert.equal(repo.stats().missingReview, 2);
assert.equal(repo.list({ query: '北平' }).items[0].slug, 'all-quiet-in-peking');
assert.equal(repo.list({ filter: 'planned' }).items[0].title, '三体');

const item = repo.list({ filter: 'missing_review' }).items[0];
repo.update(item.id, {
  status: 'read',
  status_label: '已读',
  progress: '已完成',
  author: '刘和平',
  summary: '重新整理后的简介。',
  quote: '新的摘句。',
  review: '这是一段由管理端保存的书评内容，用来验证前台可以读取。',
  spine_color: '#111827',
  accent_color: '#f97316',
  is_featured: true,
});

const updated = repo.get(item.id);
assert.equal(updated.status, 'read');
assert.equal(updated.review, '这是一段由管理端保存的书评内容，用来验证前台可以读取。');
assert.equal(updated.is_featured, 1);

const imageUpdated = repo.saveImage(item.id, {
  originalName: 'cover.webp',
  buffer: Buffer.from('fake-image'),
});

assert.equal(imageUpdated.image_path, '/uploads/reading/%E5%8C%97%E5%B9%B3%E6%97%A0%E6%88%98%E4%BA%8B.webp');
assert.ok(fs.existsSync(path.join(uploadDir, '北平无战事.webp')));
assert.equal(safeReadingImageBaseName('六经责我开生面——刘和平谈艺录'), '六经责我开生面——刘和平谈艺录');

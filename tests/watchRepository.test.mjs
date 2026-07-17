import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWatchRepository, safeImageBaseName } from '../src/lib/server/watchRepository.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyQAAAABJRU5ErkJggg==',
  'base64',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-repo-'));
const dbPath = path.join(tmp, 'watch.sqlite');
const uploadDir = path.join(tmp, 'uploads');

const repo = createWatchRepository({ dbPath, uploadDir });
repo.initialize();
repo.upsertMany([
  {
    title: '北平无战事',
    type: '剧集',
    status: '已看',
    rating: '4',
    comment: '',
    quote: '事情我们去做，两个字，稳妥。',
    quote_source: '网络公开台词整理',
    image_path: '',
    is_featured: 1,
  },
  {
    title: '隐入尘烟',
    type: '电影',
    status: '已看',
    rating: '4',
    comment: '',
    quote: '',
    quote_source: '',
    image_path: '',
    is_featured: 0,
  },
]);

assert.equal(repo.stats().total, 2);
assert.equal(repo.stats().missingQuote, 1);
assert.equal(repo.list({ query: '北平' }).items[0].title, '北平无战事');

const item = repo.list({ filter: 'missing_quote' }).items[0];
assert.equal(item.title, '隐入尘烟');

repo.update(item.id, {
  comment: '土地、沉默和人的命运。',
  quote: '啥人有啥人的命数呢，麦子也一样。',
  quote_source: '网络公开台词整理',
  rating: '4',
  status: '已看',
  is_featured: true,
});

const updated = repo.get(item.id);
assert.equal(updated.comment, '土地、沉默和人的命运。');
assert.equal(updated.is_featured, 1);

const imageUpdated = await repo.saveImage(item.id, {
  originalName: 'poster.png',
  buffer: tinyPng,
});

assert.equal(imageUpdated.image_path, '/uploads/watch/%E9%9A%90%E5%85%A5%E5%B0%98%E7%83%9F-960.webp');
assert.equal(imageUpdated.image_small_path, '/uploads/watch/%E9%9A%90%E5%85%A5%E5%B0%98%E7%83%9F-480.webp');
assert.equal(imageUpdated.image_original_path, '/uploads/watch/original/%E9%9A%90%E5%85%A5%E5%B0%98%E7%83%9F.png');
assert.ok(fs.existsSync(path.join(uploadDir, '隐入尘烟-960.webp')));
assert.ok(fs.existsSync(path.join(uploadDir, '隐入尘烟-480.webp')));
assert.ok(fs.existsSync(path.join(uploadDir, 'original', '隐入尘烟.png')));
assert.equal(safeImageBaseName('百家讲坛《风雨张居正》'), '百家讲坛《风雨张居正》');

const renamed = repo.update(item.id, { title: '隐入尘烟（重看）', type: '纪录片' });
assert.equal(renamed.title, '隐入尘烟（重看）');
assert.equal(renamed.type, '纪录片');

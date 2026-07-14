import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeSchema, openDatabase } from '../src/lib/server/db.mjs';
import { backfillImageVariants } from '../src/lib/server/imageVariantBackfill.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAGUlEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDK+mmyQAAAABJRU5ErkJggg==',
  'base64',
);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-backfill-'));
const publicRoot = path.join(tmp, 'public');
const dbPath = path.join(tmp, 'blog.sqlite');

fs.mkdirSync(path.join(publicRoot, 'uploads', 'watch'), { recursive: true });
fs.mkdirSync(path.join(publicRoot, 'uploads', 'reading'), { recursive: true });
fs.writeFileSync(path.join(publicRoot, 'uploads', 'watch', '老影像.png'), tinyPng);
fs.writeFileSync(path.join(publicRoot, 'uploads', 'reading', '老书籍.png'), tinyPng);

const db = openDatabase(dbPath);
initializeSchema(db);
db.prepare(`
  INSERT INTO watch_items
    (title, type, status, image_path)
  VALUES
    ('老影像', '电影', '已看', '/uploads/watch/%E8%80%81%E5%BD%B1%E5%83%8F.png'),
    ('缺失影像', '电影', '已看', '/uploads/watch/missing.jpg')
`).run();
db.prepare(`
  INSERT INTO reading_items
    (slug, title, author, status, image_path)
  VALUES
    ('old-book', '老书籍', '作者', 'read', '/uploads/reading/%E8%80%81%E4%B9%A6%E7%B1%8D.png')
`).run();
db.close();

const result = await backfillImageVariants({ dbPath, publicRoot });

assert.equal(result.watch.processed, 1);
assert.equal(result.watch.missing, 1);
assert.equal(result.reading.processed, 1);
assert.equal(result.totalProcessed, 2);

const verifyDb = openDatabase(dbPath);
const watch = verifyDb.prepare("SELECT * FROM watch_items WHERE title = '老影像'").get();
const reading = verifyDb.prepare("SELECT * FROM reading_items WHERE title = '老书籍'").get();

assert.equal(watch.image_path, '/uploads/watch/%E8%80%81%E5%BD%B1%E5%83%8F-960.webp');
assert.equal(watch.image_small_path, '/uploads/watch/%E8%80%81%E5%BD%B1%E5%83%8F-480.webp');
assert.equal(watch.image_original_path, '/uploads/watch/original/%E8%80%81%E5%BD%B1%E5%83%8F.png');
assert.equal(reading.image_path, '/uploads/reading/%E8%80%81%E4%B9%A6%E7%B1%8D-960.webp');
assert.equal(reading.image_small_path, '/uploads/reading/%E8%80%81%E4%B9%A6%E7%B1%8D-480.webp');
assert.equal(reading.image_original_path, '/uploads/reading/original/%E8%80%81%E4%B9%A6%E7%B1%8D.png');

assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'watch', '老影像-960.webp')));
assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'watch', '老影像-480.webp')));
assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'watch', 'original', '老影像.png')));
assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'reading', '老书籍-960.webp')));
assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'reading', '老书籍-480.webp')));
assert.ok(fs.existsSync(path.join(publicRoot, 'uploads', 'reading', 'original', '老书籍.png')));
verifyDb.close();

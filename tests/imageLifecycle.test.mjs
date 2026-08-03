import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFoodRepository } from '../src/lib/server/foodRepository.mjs';
import { removeImageVariants } from '../src/lib/server/imageVariants.mjs';
import { createReadingRepository } from '../src/lib/server/readingRepository.mjs';
import { createWatchRepository } from '../src/lib/server/watchRepository.mjs';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function storedFiles(item, uploadDir, publicBase) {
  return [item.image_path, item.image_small_path, item.image_original_path].map((publicPath) => {
    const relative = String(publicPath).slice(publicBase.length).replace(/^\/+/, '');
    return path.join(uploadDir, ...relative.split('/').map(decodeURIComponent));
  });
}

const repositoryCases = [
  {
    name: 'watch',
    publicBase: '/uploads/watch',
    create: (tmp) => createWatchRepository({ dbPath: path.join(tmp, 'watch.sqlite'), uploadDir: path.join(tmp, 'uploads') }),
    input: { title: '测试影像', type: '电影', status: '想看' },
  },
  {
    name: 'reading',
    publicBase: '/uploads/reading',
    create: (tmp) => createReadingRepository({ dbPath: path.join(tmp, 'reading.sqlite'), uploadDir: path.join(tmp, 'uploads') }),
    input: { title: '测试书籍', author: '作者', status: 'planned' },
  },
  {
    name: 'food',
    publicBase: '/uploads/food',
    create: (tmp) => createFoodRepository({ dbPath: path.join(tmp, 'food.sqlite'), uploadDir: path.join(tmp, 'uploads') }),
    input: { title: '测试餐厅', dish: '测试菜', status: '想去' },
  },
];

for (const entry of repositoryCases) {
  test(`${entry.name} image replacement and deletion clean stored variants`, async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `${entry.name}-image-lifecycle-`));
    const uploadDir = path.join(tmp, 'uploads');
    const repository = entry.create(tmp);
    const item = repository.create(entry.input);

    const first = await repository.saveImage(item.id, { originalName: 'first.png', buffer: tinyPng });
    const firstFiles = storedFiles(first, uploadDir, entry.publicBase);
    firstFiles.forEach((file) => assert.equal(fs.existsSync(file), true));

    const second = await repository.saveImage(item.id, { originalName: 'second.png', buffer: tinyPng });
    const secondFiles = storedFiles(second, uploadDir, entry.publicBase);
    assert.notDeepEqual(secondFiles, firstFiles);
    firstFiles.forEach((file) => assert.equal(fs.existsSync(file), false));
    secondFiles.forEach((file) => assert.equal(fs.existsSync(file), true));

    assert.equal(repository.remove(item.id), true);
    secondFiles.forEach((file) => assert.equal(fs.existsSync(file), false));
  });
}

test('invalid image bytes are rejected before any file is written', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'invalid-image-lifecycle-'));
  const uploadDir = path.join(tmp, 'uploads');
  const repository = createWatchRepository({ dbPath: path.join(tmp, 'watch.sqlite'), uploadDir });
  const item = repository.create({ title: '伪造图片', type: '电影', status: '想看' });

  await assert.rejects(
    repository.saveImage(item.id, { originalName: 'fake.jpg', buffer: Buffer.from('not-an-image') }),
  );
  assert.deepEqual(fs.readdirSync(uploadDir), []);
});

test('image cleanup cannot escape the managed upload directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'image-cleanup-boundary-'));
  const uploadDir = path.join(tmp, 'uploads');
  const outsideFile = path.join(tmp, 'outside.txt');
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(outsideFile, 'keep');

  const removed = removeImageVariants(
    ['/uploads/watch/%2E%2E/outside.txt', '/uploads/watch/../outside.txt'],
    { uploadDir, publicBase: '/uploads/watch' },
  );

  assert.equal(removed, 0);
  assert.equal(fs.readFileSync(outsideFile, 'utf8'), 'keep');
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createFoodRepository } from '../src/lib/server/foodRepository.mjs';

function createRepository() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'food-repository-'));
  return createFoodRepository({
    dbPath: path.join(tmp, 'food.sqlite'),
    uploadDir: path.join(tmp, 'uploads'),
  });
}

test('food repository creates and updates a personal dining record', () => {
  const repository = createRepository();
  const item = repository.create({
    title: '长安小馆',
    dish: '油泼面',
    status: '想去',
  });

  assert.equal(item.title, '长安小馆');
  assert.equal(item.dish, '油泼面');
  assert.equal(item.status, '想去');
  assert.equal(item.published, 1);
  assert.equal(item.is_featured, 0);

  const updated = repository.update(item.id, {
    area: '西安·雁塔',
    status: '常去',
    rating: '4.6',
    would_revisit: true,
    is_featured: true,
    published: false,
    comment: '面条筋道，辣度合适。',
  });

  assert.equal(updated.area, '西安·雁塔');
  assert.equal(updated.status, '常去');
  assert.equal(updated.rating, '4.6');
  assert.equal(updated.would_revisit, 1);
  assert.equal(updated.is_featured, 1);
  assert.equal(updated.published, 0);
});

test('food repository keeps drafts off public lists and supports homepage filters', () => {
  const repository = createRepository();
  repository.create({ title: '公开常去店', status: '常去', published: true });
  repository.create({ title: '公开想去店', status: '想去', published: true });
  repository.create({ title: '私藏店', status: '吃过', published: false });

  assert.deepEqual(
    repository.list({ publishedOnly: true }).items.map((item) => item.title).sort(),
    ['公开常去店', '公开想去店'],
  );
  assert.deepEqual(
    repository.list({ filter: 'frequent', publishedOnly: true }).items.map((item) => item.title),
    ['公开常去店'],
  );
  assert.deepEqual(
    repository.list({ filter: 'wanted', publishedOnly: true }).items.map((item) => item.title),
    ['公开想去店'],
  );
  assert.equal(repository.stats().total, 3);
  assert.equal(repository.stats().published, 2);
});

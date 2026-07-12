import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { createWatchRepository } from '../src/lib/server/watchRepository.mjs';

function tempWorkspace(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  return {
    dbPath: path.join(root, 'watch.sqlite'),
    uploadDir: path.join(root, 'uploads'),
  };
}

function editable(item, overrides = {}) {
  return {
    status: item.status,
    rating: item.rating || '',
    comment: item.comment || '',
    quote: item.quote || '',
    quote_source: item.quote_source || '',
    is_featured: Boolean(item.is_featured),
    progress_text: item.progress_text || '',
    completed_at: item.completed_at || '',
    is_activity_featured: Boolean(item.is_activity_featured),
    ...overrides,
  };
}

test('watch repository migrates existing databases with activity columns', () => {
  const { dbPath, uploadDir } = tempWorkspace('watch-activity-migration');
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE watch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      rating TEXT,
      comment TEXT NOT NULL DEFAULT '',
      quote TEXT NOT NULL DEFAULT '',
      quote_source TEXT NOT NULL DEFAULT '',
      image_path TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.close();

  const repo = createWatchRepository({ dbPath, uploadDir });
  repo.initialize();

  const migrated = new Database(dbPath, { readonly: true });
  const columns = new Set(migrated.prepare('PRAGMA table_info(watch_items)').all().map((column) => column.name));
  migrated.close();

  assert.equal(columns.has('progress_text'), true);
  assert.equal(columns.has('completed_at'), true);
  assert.equal(columns.has('is_activity_featured'), true);
});

test('watch repository keeps one activity feature per status and filters activity items', () => {
  const { dbPath, uploadDir } = tempWorkspace('watch-activity-repository');
  const repo = createWatchRepository({ dbPath, uploadDir });

  const river = repo.create({ title: '大江大河', type: '剧集', status: '在看' });
  const riverTwo = repo.create({ title: '大江大河2', type: '剧集', status: '在看' });
  const protagonist = repo.create({ title: '主角', type: '剧集', status: '已看' });

  repo.update(river.id, editable(river, {
    progress_text: '第18集',
    is_activity_featured: true,
  }));
  repo.update(riverTwo.id, editable(riverTwo, {
    progress_text: '第3集',
    is_activity_featured: true,
  }));
  repo.update(protagonist.id, editable(protagonist, {
    completed_at: '2026-07-12',
    is_activity_featured: true,
  }));

  assert.equal(repo.get(river.id).is_activity_featured, 0);
  assert.equal(repo.get(riverTwo.id).is_activity_featured, 1);
  assert.equal(repo.get(riverTwo.id).progress_text, '第3集');
  assert.equal(repo.get(protagonist.id).is_activity_featured, 1);
  assert.equal(repo.get(protagonist.id).completed_at, '2026-07-12');

  assert.deepEqual(repo.list({ filter: 'watching' }).items.map((item) => item.title), ['大江大河2', '大江大河']);
  assert.deepEqual(repo.list({ filter: 'activity' }).items.map((item) => item.title).sort(), ['主角', '大江大河2'].sort());
});

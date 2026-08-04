import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  closeSharedDatabase,
  initializeSchema,
  openRepositoryDatabase,
} from '../src/lib/server/db.mjs';

test('frequent watch and reading filters have matching composite indexes', () => {
  const db = new Database(':memory:');
  initializeSchema(db);
  const indexes = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name),
  );

  assert.ok(indexes.has('idx_watch_items_status_order'));
  assert.ok(indexes.has('idx_reading_items_public_status_order'));
  assert.equal(db.pragma('user_version', { simple: true }), 2);
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'post_image_assets'").get());
  db.close();
});

test('default repositories share one configured SQLite connection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-shared-db-'));
  const previousPath = process.env.BLOG_DB_PATH;
  process.env.BLOG_DB_PATH = path.join(root, 'blog.sqlite');
  try {
    const first = openRepositoryDatabase();
    const second = openRepositoryDatabase();
    assert.equal(first, second);
    initializeSchema(first);
    assert.equal(first.pragma('user_version', { simple: true }), 2);
  } finally {
    closeSharedDatabase();
    if (previousPath === undefined) delete process.env.BLOG_DB_PATH;
    else process.env.BLOG_DB_PATH = previousPath;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

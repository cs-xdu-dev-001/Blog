import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { test } from 'node:test';
import { initializeSchema } from '../src/lib/server/db.mjs';

test('frequent watch and reading filters have matching composite indexes', () => {
  const db = new Database(':memory:');
  initializeSchema(db);
  const indexes = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name),
  );

  assert.ok(indexes.has('idx_watch_items_status_order'));
  assert.ok(indexes.has('idx_reading_items_public_status_order'));
  db.close();
});

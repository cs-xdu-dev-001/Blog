import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeSchema } from '../src/lib/server/db.mjs';

const existingColumns = [
  'progress_text',
  'completed_at',
  'is_activity_featured',
  'image_small_path',
  'image_original_path',
  'image_width',
  'image_height',
  'published',
  'would_revisit',
  'is_featured',
  'sort_order',
  'tags',
  'visibility',
  'encrypted_description',
  'encrypted_body',
];

function createFakeDatabase({ failFirstExec = false } = {}) {
  let execCalls = 0;
  return {
    exec() {
      execCalls += 1;
      if (failFirstExec && execCalls === 1) throw new Error('schema failed');
    },
    prepare() {
      return { all: () => existingColumns.map((name) => ({ name })) };
    },
    get execCalls() {
      return execCalls;
    },
  };
}

test('schema initialization runs once for the same database connection', () => {
  const db = createFakeDatabase();
  initializeSchema(db);
  const firstRunCalls = db.execCalls;
  initializeSchema(db);
  assert.equal(db.execCalls, firstRunCalls);
});

test('a failed schema initialization can be retried', () => {
  const db = createFakeDatabase({ failFirstExec: true });
  assert.throws(() => initializeSchema(db), /schema failed/);
  assert.doesNotThrow(() => initializeSchema(db));
});

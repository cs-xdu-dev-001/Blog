import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./fixtures/uploadPersistenceWorker.mjs', import.meta.url));

function runWorker(...args) {
  const result = spawnSync(process.execPath, [worker, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

test('uploaded images survive a process restart and disappear with their record', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-upload-restart-'));
  const dbPath = path.join(temporaryRoot, 'content.sqlite');
  const uploadsRoot = path.join(temporaryRoot, 'uploads');

  try {
    const created = runWorker('create', dbPath, uploadsRoot);
    assert.match(created.imagePath, /^\/uploads\/reading\/.+-960\.webp$/);

    const afterRestart = runWorker('read', dbPath, uploadsRoot, created.imagePath);
    assert.equal(afterRestart.status, 200);

    const deleted = runWorker('delete', dbPath, uploadsRoot, String(created.id));
    assert.equal(deleted.removed, true);

    const afterDeletion = runWorker('read', dbPath, uploadsRoot, created.imagePath);
    assert.equal(afterDeletion.status, 404);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

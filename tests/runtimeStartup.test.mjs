import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {
  checkRuntimeReadiness,
  prepareRuntime,
} from '../src/lib/server/runtimeStartup.mjs';

const uploadKinds = ['posts', 'reading', 'watch', 'food'];

test('runtime preparation migrates the database and creates upload directories', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-runtime-startup-'));
  const dbPath = path.join(tmp, 'data', 'blog.sqlite');
  const uploadsRoot = path.join(tmp, 'uploads');

  const result = await prepareRuntime({ dbPath, uploadsRoot });

  assert.equal(result.schemaVersion, 3);
  uploadKinds.forEach((kind) => {
    assert.equal(fs.statSync(path.join(uploadsRoot, kind)).isDirectory(), true);
  });
  const db = new Database(dbPath, { readonly: true });
  assert.equal(db.pragma('user_version', { simple: true }), 3);
  db.close();
  assert.deepEqual(await checkRuntimeReadiness({ dbPath, uploadsRoot }), { ok: true });
});

test('runtime readiness reports the failing dependency without exposing internals', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-runtime-readiness-'));
  const dbPath = path.join(tmp, 'data', 'blog.sqlite');
  const uploadsRoot = path.join(tmp, 'uploads');
  await prepareRuntime({ dbPath, uploadsRoot });
  fs.rmSync(path.join(uploadsRoot, 'watch'), { recursive: true, force: true });

  assert.deepEqual(
    await checkRuntimeReadiness({ dbPath, uploadsRoot }),
    { ok: false, failedCheck: 'uploads' },
  );
  assert.deepEqual(
    await checkRuntimeReadiness({ dbPath: path.join(tmp, 'missing', 'readonly.sqlite'), uploadsRoot }),
    { ok: false, failedCheck: 'database' },
  );
});

test('production start runs preparation before importing the Astro server', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
  const source = fs.readFileSync(path.resolve('scripts/start-server.mjs'), 'utf8');
  assert.equal(packageJson.scripts.start, 'node ./scripts/start-server.mjs');
  assert.ok(source.indexOf('await prepareRuntime()') < source.indexOf("await import('../dist/server/entry.mjs')"));
});

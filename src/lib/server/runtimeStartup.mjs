import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { getDefaultDbPath, initializeSchema, openDatabase } from './db.mjs';
import { cleanupImageStaging } from './imageVariants.mjs';
import { getUploadsRoot } from './runtimePaths.mjs';

const REQUIRED_SCHEMA_VERSION = 2;
const uploadKinds = ['posts', 'reading', 'watch', 'food'];

export { getUploadsRoot } from './runtimePaths.mjs';

async function ensureUploadDirectories(uploadsRoot) {
  await fs.mkdir(uploadsRoot, { recursive: true });
  await Promise.all(uploadKinds.map(async (kind) => {
    const uploadDir = path.join(uploadsRoot, kind);
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.access(uploadDir, constants.R_OK | constants.W_OK);
  }));
}

function checkDatabase(db) {
  db.prepare('SELECT 1').get();
  const version = Number(db.pragma('user_version', { simple: true }) || 0);
  if (version < REQUIRED_SCHEMA_VERSION) throw new Error('database schema is not current');
  return version;
}

export async function prepareRuntime({
  dbPath = getDefaultDbPath(),
  uploadsRoot = getUploadsRoot(),
} = {}) {
  const db = openDatabase(dbPath);
  let schemaVersion;
  try {
    initializeSchema(db);
    schemaVersion = checkDatabase(db);
  } finally {
    db.close();
  }

  await ensureUploadDirectories(uploadsRoot);
  const removedStagingEntries = uploadKinds.reduce(
    (total, kind) => total + cleanupImageStaging(path.join(uploadsRoot, kind)),
    0,
  );
  return { schemaVersion, removedStagingEntries };
}

export async function checkRuntimeReadiness({
  dbPath = getDefaultDbPath(),
  uploadsRoot = getUploadsRoot(),
} = {}) {
  try {
    const db = openDatabase(dbPath);
    try {
      checkDatabase(db);
    } finally {
      db.close();
    }
  } catch {
    return { ok: false, failedCheck: 'database' };
  }

  try {
    await Promise.all(uploadKinds.map((kind) => fs.access(
      path.join(uploadsRoot, kind),
      constants.R_OK | constants.W_OK,
    )));
  } catch {
    return { ok: false, failedCheck: 'uploads' };
  }
  return { ok: true };
}

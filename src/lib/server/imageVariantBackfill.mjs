import fs from 'node:fs';
import path from 'node:path';
import { initializeSchema, openDatabase } from './db.mjs';
import { safeImageBaseName, saveImageVariants } from './imageVariants.mjs';

function emptyStats() {
  return {
    processed: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
    errors: [],
  };
}

function publicPathToFile(publicRoot, publicPath) {
  const clean = String(publicPath || '').split(/[?#]/)[0];
  if (!clean.startsWith('/') || /^\/\//.test(clean)) return null;
  try {
    const segments = clean.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
    const filePath = path.resolve(publicRoot, ...segments);
    const rootPath = path.resolve(publicRoot);
    return filePath === rootPath || filePath.startsWith(`${rootPath}${path.sep}`) ? filePath : null;
  } catch {
    return null;
  }
}

function shouldSkip(row, publicRoot) {
  if (!row.image_small_path || !row.image_original_path) return false;
  const main = publicPathToFile(publicRoot, row.image_path);
  const small = publicPathToFile(publicRoot, row.image_small_path);
  const original = publicPathToFile(publicRoot, row.image_original_path);
  return [main, small, original].every((file) => file && fs.existsSync(file));
}

async function backfillTable(db, {
  key,
  table,
  publicRoot,
  publicBase,
  uploadDir,
  baseNameFor,
  force,
}) {
  const stats = emptyStats();
  const rows = db.prepare(`
    SELECT id, title, image_path, image_small_path, image_original_path
    FROM ${table}
    WHERE image_path <> ''
    ORDER BY id ASC
  `).all();

  for (const row of rows) {
    if (!force && shouldSkip(row, publicRoot)) {
      stats.skipped += 1;
      continue;
    }

    const originalFile = publicPathToFile(publicRoot, row.image_original_path);
    const currentFile = publicPathToFile(publicRoot, row.image_path);
    const sourceFile = originalFile && fs.existsSync(originalFile) ? originalFile : currentFile;
    if (!sourceFile || !fs.existsSync(sourceFile)) {
      stats.missing += 1;
      stats.errors.push({ id: row.id, title: row.title, reason: 'source image missing' });
      continue;
    }

    try {
      const buffer = fs.readFileSync(sourceFile);
      const variants = await saveImageVariants({
        baseName: baseNameFor(row.title),
        originalName: path.basename(sourceFile),
        buffer,
        uploadDir,
        publicBase,
      });
      db.prepare(`
        UPDATE ${table} SET
          image_path = @imagePath,
          image_small_path = @smallPath,
          image_original_path = @originalPath,
          image_width = @width,
          image_height = @height,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({ id: row.id, ...variants });
      stats.processed += 1;
    } catch (error) {
      stats.failed += 1;
      stats.errors.push({
        id: row.id,
        title: row.title,
        reason: error?.message || 'image processing failed',
      });
    }
  }

  return { key, stats };
}

export async function backfillImageVariants({
  dbPath,
  publicRoot = path.resolve(process.cwd(), 'public'),
  force = false,
} = {}) {
  const db = openDatabase(dbPath);
  initializeSchema(db);

  const tasks = [
    {
      key: 'watch',
      table: 'watch_items',
      publicBase: '/uploads/watch',
      uploadDir: path.join(publicRoot, 'uploads', 'watch'),
      baseNameFor: (title) => safeImageBaseName(title, 'watch-image'),
    },
    {
      key: 'reading',
      table: 'reading_items',
      publicBase: '/uploads/reading',
      uploadDir: path.join(publicRoot, 'uploads', 'reading'),
      baseNameFor: (title) => safeImageBaseName(title, 'reading-cover'),
    },
  ];

  const result = {};
  for (const task of tasks) {
    const { key, stats } = await backfillTable(db, { ...task, publicRoot, force });
    result[key] = stats;
  }
  db.close();

  result.totalProcessed = Object.values(result)
    .filter((value) => value && typeof value.processed === 'number')
    .reduce((sum, value) => sum + value.processed, 0);
  result.totalMissing = Object.values(result)
    .filter((value) => value && typeof value.missing === 'number')
    .reduce((sum, value) => sum + value.missing, 0);
  result.totalFailed = Object.values(result)
    .filter((value) => value && typeof value.failed === 'number')
    .reduce((sum, value) => sum + value.failed, 0);
  return result;
}

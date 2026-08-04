import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { getUploadsRoot } from './runtimePaths.mjs';

const allowedUploadKinds = new Set(['posts', 'reading', 'watch', 'food']);
const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
]);

function notFound() {
  return new Response('Not found', { status: 404 });
}

function decodeRelativePath(value) {
  try {
    return decodeURIComponent(String(value || '')).replaceAll('\\', '/');
  } catch {
    return '';
  }
}

export async function servePostImage(relativePath, { root = path.join(getUploadsRoot(), 'posts') } = {}) {
  return serveImageFile(relativePath, root);
}

async function serveImageFile(relativePath, root) {
  const decodedPath = decodeRelativePath(relativePath);
  if (!decodedPath || decodedPath.includes('\0')) return notFound();

  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, decodedPath);
  const relative = path.relative(absoluteRoot, target);
  if (
    !relative
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    return notFound();
  }

  const contentType = contentTypes.get(path.extname(target).toLowerCase());
  if (!contentType) return notFound();

  try {
    const stats = await fs.stat(target);
    if (!stats.isFile()) return notFound();
    const stream = Readable.toWeb(createReadStream(target));
    return new Response(stream, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(stats.size),
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') return notFound();
    throw error;
  }
}

export async function serveUploadedImage(kind, relativePath, { root = getUploadsRoot() } = {}) {
  const normalizedKind = String(kind || '').trim().toLowerCase();
  if (!allowedUploadKinds.has(normalizedKind)) return notFound();
  return serveImageFile(relativePath, path.join(root, normalizedKind));
}

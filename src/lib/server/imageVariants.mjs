import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const formatExtensions = new Map([
  ['jpeg', '.jpg'],
  ['png', '.png'],
  ['webp', '.webp'],
  ['avif', '.avif'],
]);

export function safeImageBaseName(value, fallback = 'image') {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;
}

export function uniqueImageBaseName(value, fallback = 'image') {
  return `${safeImageBaseName(value, fallback)}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function encodedPublicPath(base, ...segments) {
  return [base.replace(/\/+$/, ''), ...segments.map((segment) => encodeURIComponent(segment))]
    .filter(Boolean)
    .join('/');
}

export function storedImagePaths(item = {}) {
  return [
    item.image_path ?? item.imagePath,
    item.image_small_path ?? item.small_path ?? item.smallPath,
    item.image_original_path ?? item.original_path ?? item.originalPath,
  ].map((value) => String(value || '').trim()).filter(Boolean);
}

function localImagePath(publicPath, uploadDir, publicBase) {
  const cleanPath = String(publicPath || '').split(/[?#]/, 1)[0];
  const prefix = `/${String(publicBase || '').replace(/^\/+|\/+$/g, '')}`;
  if (cleanPath !== prefix && !cleanPath.startsWith(`${prefix}/`)) return '';

  const encodedSegments = cleanPath.slice(prefix.length).replace(/^\/+/, '').split('/').filter(Boolean);
  const segments = [];
  for (const segment of encodedSegments) {
    let decoded;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return '';
    }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/]/.test(decoded)) return '';
    segments.push(decoded);
  }
  if (!segments.length) return '';

  const root = path.resolve(uploadDir);
  const target = path.resolve(root, ...segments);
  return target.startsWith(`${root}${path.sep}`) ? target : '';
}

export function existingImageVariants(paths, { uploadDir, publicBase }) {
  const existing = [];
  for (const publicPath of new Set(paths)) {
    const target = localImagePath(publicPath, uploadDir, publicBase);
    if (!target) continue;
    try {
      if (fs.statSync(target, { throwIfNoEntry: false })?.isFile()) existing.push(publicPath);
    } catch {
      // A later cleanup pass can retry files that are temporarily inaccessible.
    }
  }
  return existing;
}

export function removeImageVariants(paths, { uploadDir, publicBase, excludePaths = [] }) {
  const excluded = new Set(excludePaths.map((value) => String(value || '')));
  let removed = 0;
  for (const publicPath of new Set(paths)) {
    if (!publicPath || excluded.has(publicPath)) continue;
    const target = localImagePath(publicPath, uploadDir, publicBase);
    if (!target) continue;
    try {
      const stat = fs.statSync(target, { throwIfNoEntry: false });
      if (!stat?.isFile()) continue;
      fs.unlinkSync(target);
      removed += 1;
    } catch {
      // File cleanup is best effort; the database operation remains authoritative.
    }
  }
  return removed;
}

export async function saveImageVariants({
  baseName,
  originalName,
  buffer,
  uploadDir,
  publicBase,
}) {
  const requestedExt = path.extname(originalName).toLowerCase();
  const image = sharp(buffer, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();
  const detectedExt = formatExtensions.get(metadata.format);
  if (!detectedExt || !metadata.width || !metadata.height) throw new Error('unsupported image data');
  const requestedMatchesFormat = requestedExt === detectedExt
    || (metadata.format === 'jpeg' && ['.jpg', '.jpeg'].includes(requestedExt));
  const safeExt = requestedMatchesFormat ? requestedExt : detectedExt;
  const originalFile = `${baseName}${safeExt}`;
  const smallFile = `${baseName}-480.webp`;
  const mainFile = `${baseName}-960.webp`;
  const originalDir = path.join(uploadDir, 'original');

  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const originalPath = path.join(originalDir, originalFile);
  const smallPath = path.join(uploadDir, smallFile);
  const mainPath = path.join(uploadDir, mainFile);

  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(originalDir, { recursive: true });
  try {
    fs.writeFileSync(originalPath, buffer);
    const results = await Promise.allSettled([
      image
        .clone()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toFile(smallPath),
      image
        .clone()
        .resize({ width: 960, withoutEnlargement: true })
        .webp({ quality: 86, effort: 4 })
        .toFile(mainPath),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
  } catch (error) {
    [originalPath, smallPath, mainPath].forEach((file) => {
      try { fs.rmSync(file, { force: true }); } catch { /* best effort */ }
    });
    throw error;
  }

  return {
    imagePath: encodedPublicPath(publicBase, mainFile),
    smallPath: encodedPublicPath(publicBase, smallFile),
    originalPath: encodedPublicPath(publicBase, 'original', originalFile),
    width,
    height,
  };
}

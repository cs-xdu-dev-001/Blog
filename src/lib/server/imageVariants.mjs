import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

export function safeImageBaseName(value, fallback = 'image') {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || fallback;
}

function encodedPublicPath(base, ...segments) {
  return [base.replace(/\/+$/, ''), ...segments.map((segment) => encodeURIComponent(segment))]
    .filter(Boolean)
    .join('/');
}

export async function saveImageVariants({
  baseName,
  originalName,
  buffer,
  uploadDir,
  publicBase,
}) {
  const ext = path.extname(originalName).toLowerCase();
  const safeExt = allowedExtensions.has(ext) ? ext : '.jpg';
  const originalFile = `${baseName}${safeExt}`;
  const smallFile = `${baseName}-480.webp`;
  const mainFile = `${baseName}-960.webp`;
  const originalDir = path.join(uploadDir, 'original');

  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(originalDir, { recursive: true });
  fs.writeFileSync(path.join(originalDir, originalFile), buffer);

  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);

  await Promise.all([
    image
      .clone()
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toFile(path.join(uploadDir, smallFile)),
    image
      .clone()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 })
      .toFile(path.join(uploadDir, mainFile)),
  ]);

  return {
    imagePath: encodedPublicPath(publicBase, mainFile),
    smallPath: encodedPublicPath(publicBase, smallFile),
    originalPath: encodedPublicPath(publicBase, 'original', originalFile),
    width,
    height,
  };
}

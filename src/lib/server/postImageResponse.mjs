import fs from 'node:fs/promises';
import path from 'node:path';

const defaultRoot = path.resolve(process.cwd(), 'public', 'uploads', 'posts');
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

export async function servePostImage(relativePath, { root = defaultRoot } = {}) {
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
    const file = await fs.readFile(target);
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': String(file.length),
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'EISDIR') return notFound();
    throw error;
  }
}

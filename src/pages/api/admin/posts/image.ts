import path from 'node:path';
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { safeImageBaseName, saveImageVariants } from '../../../../lib/server/imageVariants.mjs';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const extensions = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/avif', '.avif'],
]);
const maxImageSize = 8 * 1024 * 1024;

function decodeImageName(value: string | null) {
  try {
    return decodeURIComponent(value || '').trim();
  } catch {
    return '';
  }
}

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const contentType = String(context.request.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const contentLength = Number(context.request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxImageSize) {
    return new Response('Image too large', { status: 413 });
  }

  let originalName = '';
  let imageType = '';
  let buffer: Buffer;

  if (allowedTypes.has(contentType)) {
    imageType = contentType;
    originalName = decodeImageName(context.request.headers.get('x-image-name'));
    buffer = Buffer.from(await context.request.arrayBuffer());
  } else if (contentType === 'multipart/form-data') {
    const form = await context.request.formData();
    const file = form.get('image');
    if (!(file instanceof File)) return new Response('Missing image', { status: 400 });
    imageType = file.type;
    originalName = file.name;
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    return new Response('Unsupported image type', { status: 415 });
  }

  if (!allowedTypes.has(imageType)) {
    return new Response('Unsupported image type', { status: 415 });
  }
  if (!buffer.length) return new Response('Missing image', { status: 400 });
  if (buffer.length > maxImageSize) {
    return new Response('Image too large', { status: 413 });
  }

  const extension = path.extname(originalName) || extensions.get(imageType) || '';
  const normalizedName = originalName || `post-image${extension}`;
  const stem = safeImageBaseName(path.basename(normalizedName, path.extname(normalizedName)), 'post-image');
  const image = await saveImageVariants({
    baseName: `${Date.now()}-${stem}`,
    originalName: normalizedName,
    buffer,
    uploadDir: path.resolve(process.cwd(), 'public', 'uploads', 'posts'),
    publicBase: '/uploads/posts',
  });

  return Response.json({ image });
};

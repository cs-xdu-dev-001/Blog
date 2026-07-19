import path from 'node:path';
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { safeImageBaseName, saveImageVariants } from '../../../../lib/server/imageVariants.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const form = await context.request.formData();
  const file = form.get('image');

  if (!(file instanceof File)) return new Response('Missing image', { status: 400 });
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    return new Response('Unsupported image type', { status: 415 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return new Response('Image too large', { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stem = safeImageBaseName(path.basename(file.name, path.extname(file.name)), 'post-image');
  const image = await saveImageVariants({
    baseName: `${Date.now()}-${stem}`,
    originalName: file.name,
    buffer,
    uploadDir: path.resolve(process.cwd(), 'public', 'uploads', 'posts'),
    publicBase: '/uploads/posts',
  });

  return Response.json({ image });
};

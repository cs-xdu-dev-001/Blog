import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/server/auth.mjs';
import { readingRepository } from '../../../../../lib/server/readingRepository.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
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
  const updated = readingRepository.saveImage(id, { originalName: file.name, buffer });
  if (!updated) return new Response('Not found', { status: 404 });

  return Response.json({ item: updated, stats: readingRepository.stats() });
};

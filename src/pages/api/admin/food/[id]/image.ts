import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/server/auth.mjs';
import { foodRepository } from '../../../../../lib/server/foodRepository.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const form = await context.request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return new Response('Missing image', { status: 400 });
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    return new Response('Unsupported image type', { status: 415 });
  }
  if (file.size > 8 * 1024 * 1024) return new Response('Image too large', { status: 413 });

  const updated = await foodRepository.saveImage(Number(context.params.id), {
    originalName: file.name,
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  return updated
    ? Response.json({ item: updated, stats: foodRepository.stats() })
    : new Response('Not found', { status: 404 });
};

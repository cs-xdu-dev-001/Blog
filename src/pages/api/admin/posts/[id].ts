import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { postRepository } from '../../../../lib/server/postRepository.mjs';

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const body = await context.request.json().catch(() => ({}));
  const updated = postRepository.update(id, {
    title: String(body.title || ''),
    slug: String(body.slug || ''),
    category: String(body.category || ''),
    description: String(body.description || ''),
    body: String(body.body || ''),
    date: String(body.date || ''),
    featured: Boolean(body.featured),
    published: Boolean(body.published),
    topicSlugs: body.topicSlugs,
  });

  if (!updated) return new Response('Not found', { status: 404 });

  return Response.json({ item: updated, stats: postRepository.stats() });
};

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const removed = postRepository.remove(id);
  if (!removed) return new Response('Not found', { status: 404 });

  return Response.json({ ok: true, stats: postRepository.stats() });
};

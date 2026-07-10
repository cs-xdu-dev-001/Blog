import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { watchRepository } from '../../../../lib/server/watchRepository.mjs';

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const body = await context.request.json();
  const updated = watchRepository.update(id, {
    status: String(body.status || '已看'),
    rating: String(body.rating || ''),
    comment: String(body.comment || ''),
    quote: String(body.quote || ''),
    quote_source: String(body.quote_source || ''),
    is_featured: Boolean(body.is_featured),
  });

  if (!updated) return new Response('Not found', { status: 404 });

  return Response.json({ item: updated, stats: watchRepository.stats() });
};

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const removed = watchRepository.remove(id);
  if (!removed) return new Response('Not found', { status: 404 });

  return Response.json({ ok: true, stats: watchRepository.stats() });
};

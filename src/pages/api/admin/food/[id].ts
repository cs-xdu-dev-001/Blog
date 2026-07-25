import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { foodRepository } from '../../../../lib/server/foodRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const item = foodRepository.get(Number(context.params.id));
  return item ? Response.json({ item }) : new Response('Not found', { status: 404 });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const body = await context.request.json().catch(() => ({}));
  const updated = foodRepository.update(Number(context.params.id), {
    title: body.title == null ? undefined : String(body.title),
    dish: body.dish == null ? undefined : String(body.dish),
    area: body.area == null ? undefined : String(body.area),
    status: body.status == null ? undefined : String(body.status),
    rating: body.rating == null ? undefined : String(body.rating),
    visit_date: body.visit_date == null ? undefined : String(body.visit_date),
    comment: body.comment == null ? undefined : String(body.comment),
    would_revisit: body.would_revisit == null ? undefined : Boolean(body.would_revisit),
    is_featured: body.is_featured == null ? undefined : Boolean(body.is_featured),
    published: body.published == null ? undefined : Boolean(body.published),
    sort_order: body.sort_order == null ? undefined : Number(body.sort_order),
  });
  return updated
    ? Response.json({ item: updated, stats: foodRepository.stats() })
    : new Response('Not found', { status: 404 });
};
export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const removed = foodRepository.remove(Number(context.params.id));
  return removed
    ? Response.json({ ok: true, stats: foodRepository.stats() })
    : new Response('Not found', { status: 404 });
};

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { readingRepository } from '../../../../lib/server/readingRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const item = readingRepository.get(Number(context.params.id));
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json({ item });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const body = await context.request.json();
  const status = String(body.status || 'reading');
  const statusLabel = status === 'read' ? '已读' : status === 'planned' ? '待读' : '在读';
  const updated = readingRepository.update(id, {
    title: body.title == null ? undefined : String(body.title),
    author: String(body.author || ''),
    status,
    status_label: String(body.status_label || statusLabel),
    progress: String(body.progress || ''),
    summary: String(body.summary || ''),
    quote: String(body.quote || ''),
    review: String(body.review || ''),
    spine_color: String(body.spine_color || '#263548'),
    accent_color: String(body.accent_color || '#ff9138'),
    is_featured: Boolean(body.is_featured),
  });

  if (!updated) return new Response('Not found', { status: 404 });

  return Response.json({ item: updated, stats: readingRepository.stats() });
};

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const removed = readingRepository.remove(id);
  if (!removed) return new Response('Not found', { status: 404 });

  return Response.json({ ok: true, stats: readingRepository.stats() });
};

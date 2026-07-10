import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { watchRepository } from '../../../../lib/server/watchRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const query = url.searchParams.get('query') || '';
  const filter = url.searchParams.get('filter') || 'all';

  return Response.json(watchRepository.list({ query, filter }));
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const title = String(input.title || '').trim();
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const item = watchRepository.create({
    title,
    type: input.type,
    status: input.status,
  });

  return Response.json({ item, stats: watchRepository.stats() }, { status: 201 });
};

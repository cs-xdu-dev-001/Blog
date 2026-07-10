import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { readingRepository } from '../../../../lib/server/readingRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const query = url.searchParams.get('query') || '';
  const filter = url.searchParams.get('filter') || 'all';

  return Response.json(readingRepository.list({ query, filter }));
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const title = String(input.title || '').trim();
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const item = readingRepository.create({
    title,
    author: input.author,
    status: input.status,
  });

  return Response.json({ item, stats: readingRepository.stats() }, { status: 201 });
};

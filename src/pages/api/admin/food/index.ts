import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { foodRepository } from '../../../../lib/server/foodRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const url = new URL(context.request.url);
  return Response.json(foodRepository.list({
    query: url.searchParams.get('query') || '',
    filter: url.searchParams.get('filter') || 'all',
    page: url.searchParams.get('page') || 1,
    pageSize: url.searchParams.get('pageSize') || 30,
  }));
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const input = await context.request.json().catch(() => ({}));
  const title = String(input.title || '').trim();
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });
  const item = foodRepository.create({
    title,
    dish: input.dish,
    area: input.area,
    status: input.status,
    published: input.published !== false,
  });
  return Response.json({ item, stats: foodRepository.stats() }, { status: 201 });
};

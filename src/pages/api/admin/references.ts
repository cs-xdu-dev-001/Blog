import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/server/auth.mjs';
import { contentReferenceService } from '../../../lib/server/contentReferenceService.mjs';

export const prerender = false;

export const GET: APIRoute = (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const query = String(context.url.searchParams.get('q') || '').trim();
  if (query.length > 100) {
    return Response.json({ error: '查询内容过长' }, { status: 400 });
  }

  return Response.json({
    items: query ? contentReferenceService.search(query) : [],
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
};

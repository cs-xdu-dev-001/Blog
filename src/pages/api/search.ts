import type { APIRoute } from 'astro';
import { searchService } from '../../lib/server/searchService.mjs';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const query = String(url.searchParams.get('q') || '').trim();
  if (query.length > 100) {
    return Response.json({ error: '查询内容过长' }, { status: 400 });
  }

  return Response.json(searchService.search(query), {
    headers: { 'Cache-Control': 'no-store' },
  });
};

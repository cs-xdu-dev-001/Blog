import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { radarRepository } from '../../../../lib/server/radarRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const scope = url.searchParams.get('scope') || 'all';
  return Response.json(radarRepository.list({ scope }));
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const label = String(input.label || '').trim();
  if (!label) return Response.json({ error: 'label is required' }, { status: 400 });

  const item = radarRepository.create(input);
  return Response.json({ item, stats: radarRepository.stats() }, { status: 201 });
};

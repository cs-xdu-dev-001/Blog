import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { radarRepository } from '../../../../lib/server/radarRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const item = radarRepository.get(Number(context.params.id));
  if (!item) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ item });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const input = await context.request.json().catch(() => ({}));
  const label = String(input.label || '').trim();
  if (!id || !label) return Response.json({ error: 'invalid radar tag' }, { status: 400 });

  const updated = radarRepository.update(id, input);
  if (!updated) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ item: updated, stats: radarRepository.stats() });
};

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const removed = radarRepository.remove(id);
  if (!removed) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ ok: true, stats: radarRepository.stats() });
};

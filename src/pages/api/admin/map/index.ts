import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { mapRepository } from '../../../../lib/server/mapRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  return Response.json({ config: mapRepository.getConfig() });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });
  const input = await context.request.json();
  return Response.json({ config: mapRepository.saveConfig(input) });
};

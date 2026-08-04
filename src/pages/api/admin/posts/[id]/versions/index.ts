import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/server/auth.mjs';
import { postRepository } from '../../../../../../lib/server/postRepository.mjs';

export const GET: APIRoute = (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  if (!Number.isInteger(id) || !postRepository.get(id)) {
    return new Response('Not found', { status: 404 });
  }

  return Response.json({ items: postRepository.listVersions(id) });
};

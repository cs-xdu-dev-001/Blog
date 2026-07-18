import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { postRepository } from '../../../../lib/server/postRepository.mjs';

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const body = await context.request.json().catch(() => ({}));
  const tag = String(body.tag || '').trim();
  if (!tag) return Response.json({ error: 'tag is required' }, { status: 400 });

  return Response.json(postRepository.deleteTag(tag));
};

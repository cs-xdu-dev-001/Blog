import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { postRepository } from '../../../../lib/server/postRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  postRepository.ensureSeededFromContent();
  const url = new URL(context.request.url);
  const query = url.searchParams.get('query') || '';
  const filter = url.searchParams.get('filter') || 'all';

  return Response.json(postRepository.list({
    query,
    filter,
    topicSlug: url.searchParams.get('topicSlug') || '',
  }));
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const title = String(input.title || '').trim();
  if (!title) return Response.json({ error: 'title is required' }, { status: 400 });

  const item = postRepository.create({
    title,
    category: input.category || 'Notes',
    description: input.description || '',
    body: input.body || '',
    featured: Boolean(input.featured),
    published: input.published !== false,
    date: input.date,
    tags: input.tags || [],
    topicSlugs: input.topicSlugs || [],
  });

  return Response.json({ item, stats: postRepository.stats() }, { status: 201 });
};

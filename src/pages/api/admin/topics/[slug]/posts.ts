import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/server/auth.mjs';
import { postRepository } from '../../../../../lib/server/postRepository.mjs';
import { siteConfigRepository } from '../../../../../lib/server/siteConfigRepository.mjs';

function publicPost(post) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.description,
    category: post.category,
    date: post.date,
    published: Boolean(post.published),
  };
}

function topicPostView(slug) {
  const topic = siteConfigRepository.listTopics().find((item) => item.slug === slug);
  if (!topic) return null;

  postRepository.ensureSeededFromContent();
  const linked = postRepository.list({ filter: 'all', topicSlug: slug, limit: 500 }).items;
  const linkedIds = new Set(linked.map((post) => post.id));
  const available = postRepository.list({ filter: 'all', limit: 500 }).items
    .filter((post) => !linkedIds.has(post.id));

  return {
    topic,
    linked: linked.map(publicPost),
    available: available.map(publicPost),
  };
}

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const slug = String(context.params.slug || '');
  const view = topicPostView(slug);
  if (!view) return new Response('Not found', { status: 404 });
  return Response.json(view);
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const slug = String(context.params.slug || '');
  if (!siteConfigRepository.listTopics().some((item) => item.slug === slug)) {
    return new Response('Not found', { status: 404 });
  }

  const input = await context.request.json().catch(() => ({}));
  if (!Array.isArray(input.postIds) || input.postIds.some((value) => !Number.isInteger(Number(value)))) {
    return Response.json({ error: 'postIds must be an array of integers' }, { status: 400 });
  }

  postRepository.setTopicPostOrder(slug, input.postIds);
  return Response.json(topicPostView(slug));
};

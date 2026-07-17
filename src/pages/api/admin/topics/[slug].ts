import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const slug = String(context.params.slug || '');
  const item = siteConfigRepository.listTopics().find((topic) => topic.slug === slug);
  if (!item) return new Response('Not found', { status: 404 });
  return Response.json({ item });
};

export const PUT: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const slug = String(context.params.slug || '');
  const input = await context.request.json().catch(() => ({}));
  const item = siteConfigRepository.updateTopic(slug, input);
  if (!item) return new Response('Not found', { status: 404 });

  return Response.json({
    item,
    items: siteConfigRepository.listTopics(),
  });
};

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const slug = String(context.params.slug || '');
  const removed = siteConfigRepository.deleteTopic(slug);
  if (!removed) return new Response('Not found', { status: 404 });

  return Response.json({
    ok: true,
    items: siteConfigRepository.listTopics(),
  });
};

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  return Response.json({
    items: siteConfigRepository.listTopics(),
    config: siteConfigRepository.getSiteConfig(),
  });
};

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const item = siteConfigRepository.createTopic(input);

  return Response.json({
    item,
    items: siteConfigRepository.listTopics(),
  }, { status: 201 });
};

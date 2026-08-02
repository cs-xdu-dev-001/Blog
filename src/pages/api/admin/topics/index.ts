import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';
import { paginateAdminItems } from '../../../../lib/server/adminPagination.mjs';

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(context.request.url);
  const query = String(url.searchParams.get('query') || '').trim().toLocaleLowerCase('zh-CN');
  const topics = siteConfigRepository.listTopics();
  const filtered = query
    ? topics.filter((item) => [item.title, item.slug, item.meta, item.text]
      .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(query)))
    : topics;
  const result = paginateAdminItems(filtered, {
    page: url.searchParams.get('page') || 1,
    pageSize: url.searchParams.get('pageSize') || 30,
  });

  return Response.json({
    ...result,
    totalTopics: topics.length,
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

import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { githubCommentsService } from '../../../../lib/server/githubCommentsService.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';
import { paginateAdminItems } from '../../../../lib/server/adminPagination.mjs';

function errorResponse(error: any) {
  return Response.json({
    error: String(error?.message || '留言读取失败'),
    code: String(error?.code || 'COMMENTS_ERROR'),
  }, {
    status: Number(error?.status || 502),
  });
}

export const GET: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  try {
    const comments = siteConfigRepository.getSiteConfig().comments || {};
    const url = new URL(context.request.url);
    const force = url.searchParams.get('refresh') === '1';
    const result = await githubCommentsService.listComments({
      repo: comments.repo,
      categoryId: comments.categoryId,
      force,
    });
    const query = String(url.searchParams.get('query') || '').trim().toLocaleLowerCase('zh-CN');
    const filtered = query
      ? result.items.filter((item) => `${item.body} ${item.author?.login} ${item.discussion?.title}`
        .toLocaleLowerCase('zh-CN')
        .includes(query))
      : result.items;
    const paged = paginateAdminItems(filtered, {
      page: url.searchParams.get('page') || 1,
      pageSize: url.searchParams.get('pageSize') || 30,
    });
    return Response.json({
      ...paged,
      totalComments: result.total,
      discussions: result.discussions,
    });
  } catch (error) {
    return errorResponse(error);
  }
};

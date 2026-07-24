import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { githubCommentsService } from '../../../../lib/server/githubCommentsService.mjs';
import { siteConfigRepository } from '../../../../lib/server/siteConfigRepository.mjs';

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
    const result = await githubCommentsService.listComments({
      repo: comments.repo,
      categoryId: comments.categoryId,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
};

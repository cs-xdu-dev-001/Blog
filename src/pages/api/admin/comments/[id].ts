import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { githubCommentsService } from '../../../../lib/server/githubCommentsService.mjs';

function errorResponse(error: any) {
  return Response.json({
    error: String(error?.message || '留言删除失败'),
    code: String(error?.code || 'COMMENTS_ERROR'),
  }, {
    status: Number(error?.status || 502),
  });
}

export const DELETE: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  try {
    const deleted = await githubCommentsService.deleteComment(context.params.id);
    return Response.json({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
};

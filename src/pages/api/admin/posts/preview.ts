import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { markdownToHtml } from '../../../../lib/server/markdownRenderer.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const body = await context.request.json().catch(() => ({}));
  const rendered = markdownToHtml(String(body.markdown || ''));

  return Response.json({
    html: rendered.html,
    headings: rendered.headings,
  });
};

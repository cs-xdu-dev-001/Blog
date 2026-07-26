import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { editAssistantMarkdown } from '../../../../lib/server/assistantService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const result = await editAssistantMarkdown(input, {
    signal: context.request.signal,
  });
  if (!result.ok) {
    return Response.json({
      error: result.error,
      code: result.code,
    }, { status: result.status });
  }
  return Response.json({ text: result.text });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

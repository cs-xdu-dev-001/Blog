import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { testAssistantConfig } from '../../../../lib/server/assistantService.mjs';
import { testWebSearchConfig } from '../../../../lib/server/webSearchService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const assistant = input.assistant || {};
  const result = await testAssistantConfig(assistant);
  if (!result.ok) return Response.json(result, { status: 400 });
  const webSearch = await testWebSearchConfig(assistant);
  const body = {
    ...result,
    ok: result.ok && webSearch.ok,
    webSearch,
    error: webSearch.ok ? result.error : webSearch.error,
  };
  return Response.json(body, { status: body.ok ? 200 : 400 });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

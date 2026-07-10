import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { testAssistantConfig } from '../../../../lib/server/assistantService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const result = await testAssistantConfig(input.assistant || {});
  return Response.json(result, { status: result.ok ? 200 : 400 });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

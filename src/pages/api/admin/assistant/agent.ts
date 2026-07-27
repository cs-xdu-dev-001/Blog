import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { runAdminAgent } from '../../../../lib/server/adminAgentService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const result = await runAdminAgent(input, {
    signal: context.request.signal,
  });
  if (!result.ok) {
    return Response.json({
      error: result.error,
      code: result.code,
    }, { status: result.status });
  }
  return Response.json({
    message: result.message,
    proposal: result.proposal,
  });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

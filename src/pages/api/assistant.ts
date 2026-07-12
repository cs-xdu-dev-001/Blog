import type { APIRoute } from 'astro';
import { assistantService } from '../../lib/server/assistantService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({}));
  const result = await assistantService.answer(body.question, context.request, body.messages);
  return Response.json(result.body, { status: result.status });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

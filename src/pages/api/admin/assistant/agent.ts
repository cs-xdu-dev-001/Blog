import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/server/auth.mjs';
import { encodeAssistantSse } from '../../../../lib/server/assistantService.mjs';
import { streamAdminAgent } from '../../../../lib/server/adminAgentService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const input = await context.request.json().catch(() => ({}));
  const events = streamAdminAgent(input, {
    signal: context.request.signal,
  });
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(encodeAssistantSse(next.value)));
      } catch {
        controller.enqueue(encoder.encode(encodeAssistantSse({
          event: 'error',
          data: {
            code: 'INTERNAL_ERROR',
            message: 'AI助手暂时不可用',
            retryable: true,
          },
        })));
        controller.close();
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

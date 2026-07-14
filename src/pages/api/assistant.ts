import type { APIRoute } from 'astro';
import { assistantService, encodeAssistantSse } from '../../lib/server/assistantService.mjs';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({}));
  let result;
  try {
    result = await assistantService.streamAnswer(body.question, context.request, body.messages);
  } catch {
    return Response.json({
      error: 'AI助手暂时不可用',
      code: 'INTERNAL_ERROR',
      retryable: true,
    }, { status: 500 });
  }
  if (!result.events) return Response.json(result.body, { status: result.status });

  const iterator = result.events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async pull(controller) {
      if (closed) return;
      try {
        const next = await iterator.next();
        if (next.done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(encodeAssistantSse(next.value)));
      } catch {
        result.cancel?.();
        controller.enqueue(encoder.encode(encodeAssistantSse({
          event: 'error',
          data: {
            code: 'INTERNAL_ERROR',
            message: 'AI助手暂时不可用',
            retryable: true,
          },
        })));
        closed = true;
        controller.close();
      }
    },
    async cancel() {
      closed = true;
      result.cancel?.();
      await iterator.return?.();
    },
  });

  return new Response(stream, {
    status: result.status,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
};

export const GET: APIRoute = async () => (
  Response.json({ error: 'Method not allowed' }, { status: 405 })
);

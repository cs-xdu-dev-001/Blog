import type { APIRoute } from 'astro';
import { checkRuntimeReadiness } from '../lib/server/runtimeStartup.mjs';

export const prerender = false;

export const GET: APIRoute = async () => {
  const readiness = await checkRuntimeReadiness();
  return Response.json(
    readiness.ok
      ? { status: 'ready' }
      : { status: 'not_ready', check: readiness.failedCheck },
    {
      status: readiness.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
};

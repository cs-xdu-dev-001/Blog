import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => Response.json(
  { status: 'ok' },
  { headers: { 'Cache-Control': 'no-store' } },
);

import type { APIRoute } from 'astro';
import { getSessionCookieName } from '../../../lib/server/auth.mjs';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(getSessionCookieName(), { path: '/' });
  return redirect('/admin/login');
};

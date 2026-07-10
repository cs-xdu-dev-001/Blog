import type { APIRoute } from 'astro';
import {
  createSessionToken,
  getSessionCookieName,
  verifyPassword,
} from '../../../lib/server/auth.mjs';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const username = String(form.get('username') || '');
  const password = String(form.get('password') || '');
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const devPasswordHash = 'scrypt:dev-local-admin-salt:a6b301207621c40afd5bf1b2b82fd1c44a123782f143d1c1bdd071fa5d05b45c85bbc2a661b6eeb8a6964dc2e8f31cec7383ab847727f03a2d68662388b7327b';
  const adminHash = process.env.ADMIN_PASSWORD_HASH || (import.meta.env.DEV ? devPasswordHash : '');

  if (username !== adminUser || !adminHash || !verifyPassword(password, adminHash)) {
    return new Response('Invalid credentials', { status: 401 });
  }

  cookies.set(getSessionCookieName(), createSessionToken(username), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect('/admin/watch');
};

import { defineMiddleware } from 'astro:middleware';
import { requireAdmin } from './lib/server/auth.mjs';

function isPathWithin(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function preventPrivateCaching(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  const isAdminPage = isPathWithin(pathname, '/admin') && pathname !== '/admin/login';
  const isAdminSurface = isPathWithin(pathname, '/admin') || isPathWithin(pathname, '/api/admin');

  if (isAdminPage && !requireAdmin(context)) {
    return preventPrivateCaching(context.redirect('/admin/login'));
  }

  const response = await next();
  return isAdminSurface ? preventPrivateCaching(response) : response;
});

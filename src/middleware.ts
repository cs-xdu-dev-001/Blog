import { defineMiddleware } from 'astro:middleware';
import { requireAdmin } from './lib/server/auth.mjs';

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login';

  if (isAdminPage && !requireAdmin(context)) {
    return context.redirect('/admin/login');
  }

  return next();
});

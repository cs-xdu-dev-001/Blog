import { defineMiddleware } from 'astro:middleware';
import { requireAdmin } from './lib/server/auth.mjs';
import {
  completeRequestLog,
  createRequestLogContext,
  failRequestLog,
} from './lib/server/requestLogger.mjs';

function isPathWithin(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function preventPrivateCaching(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const requestLog = createRequestLogContext(context.request);
  const { pathname } = new URL(context.request.url);
  const isAdminPage = isPathWithin(pathname, '/admin') && pathname !== '/admin/login';
  const isAdminSurface = isPathWithin(pathname, '/admin') || isPathWithin(pathname, '/api/admin');

  try {
    if (isAdminPage && !requireAdmin(context)) {
      const response = preventPrivateCaching(context.redirect('/admin/login'));
      response.headers.set('X-Request-Id', requestLog.requestId);
      return completeRequestLog(requestLog, response);
    }

    const response = await next();
    response.headers.set('X-Request-Id', requestLog.requestId);
    return completeRequestLog(
      requestLog,
      isAdminSurface ? preventPrivateCaching(response) : response,
    );
  } catch (error) {
    failRequestLog(requestLog, error);
    throw error;
  }
});

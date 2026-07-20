import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/server/auth.mjs';
import {
  createLockedNoteCookieValue,
  getLockedNoteCookieMaxAge,
  getLockedNoteCookieName,
} from '../../../../../lib/server/lockedNoteCrypto.mjs';
import { postRepository } from '../../../../../lib/server/postRepository.mjs';

export const POST: APIRoute = async (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const id = Number(context.params.id);
  const body = await context.request.json().catch(() => ({}));
  const key = String(body.lockedNoteKey || '').trim();
  if (!Number.isFinite(id) || !key) {
    return Response.json({ error: 'locked note key is required' }, { status: 400 });
  }

  try {
    const item = postRepository.get(id, { unlockKey: key });
    if (!item?.locked || !item.lockedContentUnlocked) {
      return Response.json({ error: 'locked note key is invalid' }, { status: 403 });
    }
    context.cookies.set(getLockedNoteCookieName(), createLockedNoteCookieValue(key), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(context.request.url).protocol === 'https:',
      maxAge: getLockedNoteCookieMaxAge(),
    });
    return Response.json({ item });
  } catch {
    return Response.json({ error: 'locked note key is invalid' }, { status: 403 });
  }
};

import type { APIRoute } from 'astro';
import {
  createLockedNoteCookieValue,
  getLockedNoteCookieMaxAge,
  getLockedNoteCookieName,
} from '../../../../lib/server/lockedNoteCrypto.mjs';
import { postRepository } from '../../../../lib/server/postRepository.mjs';

export const POST: APIRoute = async (context) => {
  const slug = String(context.params.slug || '');
  const form = await context.request.formData().catch(() => new FormData());
  const key = String(form.get('lockedNoteKey') || '').trim();
  const failureUrl = `/posts/${encodeURIComponent(slug)}?unlock=failed`;

  if (!slug || !key) return context.redirect(failureUrl, 303);

  try {
    const post = postRepository.getBySlug(slug, { unlockKey: key });
    if (!post?.locked || !post.lockedContentUnlocked) return context.redirect(failureUrl, 303);
    context.cookies.set(getLockedNoteCookieName(), createLockedNoteCookieValue(key), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(context.request.url).protocol === 'https:',
      maxAge: getLockedNoteCookieMaxAge(),
    });
    return context.redirect(`/posts/${encodeURIComponent(slug)}`, 303);
  } catch {
    return context.redirect(failureUrl, 303);
  }
};

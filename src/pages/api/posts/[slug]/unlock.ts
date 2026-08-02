import type { APIRoute } from 'astro';
import {
  createLockedNoteCookieValue,
  getLockedNoteCookieMaxAge,
  getLockedNoteCookieName,
} from '../../../../lib/server/lockedNoteCrypto.mjs';
import { lockedNoteAttemptLimiter } from '../../../../lib/server/authAttemptLimiter.mjs';
import { postRepository } from '../../../../lib/server/postRepository.mjs';

export const POST: APIRoute = async (context) => {
  const slug = String(context.params.slug || '');
  const form = await context.request.formData().catch(() => new FormData());
  const key = String(form.get('lockedNoteKey') || '').trim();
  const failureUrl = `/posts/${encodeURIComponent(slug)}?unlock=failed`;

  if (!slug || !key) return context.redirect(failureUrl, 303);
  const attempt = await lockedNoteAttemptLimiter.consume(context.request, slug);
  if (!attempt.allowed) {
    return new Response('解锁尝试过多，请稍后重试', {
      status: 429,
      headers: { 'Retry-After': String(attempt.retryAfter) },
    });
  }

  try {
    const post = postRepository.getBySlug(slug, { unlockKey: key });
    if (!post?.locked || !post.lockedContentUnlocked) return context.redirect(failureUrl, 303);
    await lockedNoteAttemptLimiter.reset(context.request, slug);
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

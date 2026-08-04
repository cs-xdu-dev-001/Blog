import type { APIContext, APIRoute } from 'astro';
import { requireAdmin } from '../../../../../../lib/server/auth.mjs';
import {
  getLockedNoteCookieName,
  readLockedNoteKeyFromCookie,
} from '../../../../../../lib/server/lockedNoteCrypto.mjs';
import { postRepository } from '../../../../../../lib/server/postRepository.mjs';

function unlockKey(context: APIContext) {
  return readLockedNoteKeyFromCookie(context.cookies.get(getLockedNoteCookieName())?.value);
}

export const GET: APIRoute = (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  const result = postRepository.diffVersion(
    Number(context.params.id),
    Number(context.params.versionId),
    { unlockKey: unlockKey(context) },
  );
  if (!result) return new Response('Not found', { status: 404 });
  return Response.json(result);
};

export const POST: APIRoute = (context) => {
  if (!requireAdmin(context)) return new Response('Unauthorized', { status: 401 });

  try {
    const item = postRepository.restoreVersion(
      Number(context.params.id),
      Number(context.params.versionId),
      { unlockKey: unlockKey(context) },
    );
    if (!item) return new Response('Not found', { status: 404 });
    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'restore failed' }, { status: 400 });
  }
};

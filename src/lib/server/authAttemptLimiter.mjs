import crypto from 'node:crypto';
import net from 'node:net';
import { RateLimiterMemory } from 'rate-limiter-flexible';

function shouldTrustProxy() {
  if (process.env.TRUST_PROXY === '0') return false;
  return process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production';
}

function validIp(value) {
  const candidate = String(value || '').trim();
  return net.isIP(candidate) ? candidate : '';
}

export function getClientIp(request, { trustProxy = shouldTrustProxy() } = {}) {
  if (!trustProxy) return 'local';

  const realIp = validIp(request?.headers?.get?.('x-real-ip'));
  if (realIp) return realIp;

  const forwarded = String(request?.headers?.get?.('x-forwarded-for') || '')
    .split(',')
    .map((value) => validIp(value))
    .filter(Boolean);
  return forwarded.at(-1) || 'local';
}

function subjectHash(subject) {
  return crypto.createHash('sha256').update(String(subject || 'unknown')).digest('hex').slice(0, 32);
}

function retryAfter(result) {
  return Math.max(1, Math.ceil(Number(result?.msBeforeNext || 1000) / 1000));
}

export function createAuthAttemptLimiter({
  points,
  durationSeconds,
  blockSeconds,
  keyPrefix,
  resolveClientIp = getClientIp,
}) {
  const limiter = new RateLimiterMemory({
    points,
    duration: durationSeconds,
    blockDuration: blockSeconds,
    keyPrefix,
  });
  const keyFor = (request, subject) => `${resolveClientIp(request)}:${subjectHash(subject)}`;

  return {
    async consume(request, subject) {
      try {
        await limiter.consume(keyFor(request, subject));
        return { allowed: true, retryAfter: 0 };
      } catch (result) {
        return { allowed: false, retryAfter: retryAfter(result) };
      }
    },

    async reset(request, subject) {
      await limiter.delete(keyFor(request, subject));
    },
  };
}

export const adminLoginAttemptLimiter = createAuthAttemptLimiter({
  points: 5,
  durationSeconds: 15 * 60,
  blockSeconds: 30 * 60,
  keyPrefix: 'admin-login',
});

export const lockedNoteAttemptLimiter = createAuthAttemptLimiter({
  points: 8,
  durationSeconds: 15 * 60,
  blockSeconds: 30 * 60,
  keyPrefix: 'locked-note',
});

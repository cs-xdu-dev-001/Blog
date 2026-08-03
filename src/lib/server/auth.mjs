import crypto from 'node:crypto';

const SESSION_COOKIE = 'dev_notes_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEV_SESSION_SECRET = 'dev-only-session-secret';

function sessionSecret(explicitSecret) {
  const secret = String(explicitSecret || process.env.ADMIN_SESSION_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET is required in production');
  }
  return DEV_SESSION_SECRET;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createPasswordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, salt, hash] = String(storedHash || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return timingSafeStringEqual(hash, candidate);
}

export function createSessionToken(username, secret, {
  now = Date.now(),
  maxAgeSeconds = SESSION_MAX_AGE_SECONDS,
} = {}) {
  const createdAt = Number(now);
  const expiresAt = createdAt + Number(maxAgeSeconds) * 1000;
  const payload = base64url(JSON.stringify({ username, createdAt, expiresAt }));
  return `${payload}.${sign(payload, sessionSecret(secret))}`;
}

export function verifySessionToken(token, secret, { now = Date.now() } = {}) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, sessionSecret(secret));
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const createdAt = Number(data.createdAt);
    const expiresAt = Number(data.expiresAt);
    const currentTime = Number(now);
    if (
      typeof data.username !== 'string'
      || !data.username
      || !Number.isFinite(createdAt)
      || !Number.isFinite(expiresAt)
      || createdAt > currentTime + 60_000
      || expiresAt <= currentTime
      || expiresAt <= createdAt
    ) return null;
    return data;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}

export function requireAdmin(context) {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  return Boolean(verifySessionToken(token));
}

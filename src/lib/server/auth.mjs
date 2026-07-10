import crypto from 'node:crypto';

const SESSION_COOKIE = 'dev_notes_session';

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

export function createSessionToken(username, secret = process.env.ADMIN_SESSION_SECRET || 'dev-only-session-secret') {
  const payload = base64url(JSON.stringify({ username, createdAt: Date.now() }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret = process.env.ADMIN_SESSION_SECRET || 'dev-only-session-secret') {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.username === 'string' ? data : null;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function requireAdmin(context) {
  const token = context.cookies.get(SESSION_COOKIE)?.value;
  return Boolean(verifySessionToken(token));
}

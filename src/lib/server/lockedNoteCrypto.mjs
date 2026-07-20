import crypto from 'node:crypto';

const ENCRYPTED_TEXT_PREFIX = 'locked-note-v1';
const COOKIE_PREFIX = 'locked-note-cookie-v1';
const COOKIE_NAME = 'dev_notes_locked_note';
const COOKIE_MAX_AGE_SECONDS = 30 * 60;
const DEV_COOKIE_SECRET = 'dev-notes-locked-cookie-secret';

function encode(input) {
  return Buffer.from(input).toString('base64url');
}

function decode(input) {
  return Buffer.from(String(input || ''), 'base64url');
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function contentKey(secret, salt) {
  return crypto.scryptSync(secret, `locked-note:${salt.toString('base64url')}`, 32);
}

function cookieSecret() {
  return normalizeKey(
    process.env.LOCKED_NOTE_COOKIE_SECRET
    || process.env.ADMIN_SESSION_SECRET
    || process.env.SESSION_SECRET
    || DEV_COOKIE_SECRET,
  );
}

function cookieKey(salt) {
  return crypto.scryptSync(cookieSecret(), `locked-note-cookie:${salt.toString('base64url')}`, 32);
}

export function normalizeLockedNoteKey(value) {
  return normalizeKey(value);
}

export function resolveLockedNoteKey(value) {
  return normalizeKey(
    value
    || process.env.LOCKED_NOTE_KEY
    || process.env.LOCKED_NOTE_PASSWORD
    || process.env.LOCKED_NOTE_SECRET
    || '',
  );
}

export function getLockedNoteCookieName() {
  return COOKIE_NAME;
}

export function getLockedNoteCookieMaxAge() {
  return COOKIE_MAX_AGE_SECONDS;
}

export function encryptLockedText(value, keyInput) {
  const key = resolveLockedNoteKey(keyInput);
  if (!key) throw new Error('locked note key is required');

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', contentKey(key, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_TEXT_PREFIX, encode(salt), encode(iv), encode(tag), encode(ciphertext)].join(':');
}

export function decryptLockedText(payload, keyInput) {
  const key = normalizeLockedNoteKey(keyInput);
  if (!key) throw new Error('locked note key is required');

  const [prefix, saltText, ivText, tagText, ciphertextText] = String(payload || '').split(':');
  if (prefix !== ENCRYPTED_TEXT_PREFIX || !saltText || !ivText || !tagText) {
    throw new Error('invalid locked note payload');
  }

  const salt = decode(saltText);
  const iv = decode(ivText);
  const decipher = crypto.createDecipheriv('aes-256-gcm', contentKey(key, salt), iv);
  decipher.setAuthTag(decode(tagText));
  return Buffer.concat([decipher.update(decode(ciphertextText)), decipher.final()]).toString('utf8');
}

export function createLockedNoteCookieValue(keyInput, { now = Date.now() } = {}) {
  const key = normalizeLockedNoteKey(keyInput);
  if (!key) throw new Error('locked note key is required');

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const payload = JSON.stringify({
    key,
    expiresAt: now + COOKIE_MAX_AGE_SECONDS * 1000,
  });
  const cipher = crypto.createCipheriv('aes-256-gcm', cookieKey(salt), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [COOKIE_PREFIX, encode(salt), encode(iv), encode(tag), encode(ciphertext)].join(':');
}

export function readLockedNoteKeyFromCookie(value, { now = Date.now() } = {}) {
  const [prefix, saltText, ivText, tagText, ciphertextText] = String(value || '').split(':');
  if (prefix !== COOKIE_PREFIX || !saltText || !ivText || !tagText) return '';

  try {
    const salt = decode(saltText);
    const iv = decode(ivText);
    const decipher = crypto.createDecipheriv('aes-256-gcm', cookieKey(salt), iv);
    decipher.setAuthTag(decode(tagText));
    const payload = Buffer.concat([decipher.update(decode(ciphertextText)), decipher.final()]).toString('utf8');
    const data = JSON.parse(payload);
    if (!data?.expiresAt || Number(data.expiresAt) < now) return '';
    return normalizeLockedNoteKey(data.key);
  } catch {
    return '';
  }
}

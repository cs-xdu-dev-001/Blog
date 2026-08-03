import assert from 'node:assert/strict';
import {
  createPasswordHash,
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../src/lib/server/auth.mjs';

const hash = createPasswordHash('secret-password', 'fixed-salt');
assert.equal(verifyPassword('secret-password', hash), true);
assert.equal(verifyPassword('wrong-password', hash), false);

const token = createSessionToken('admin', 'session-secret', { now: 1_000, maxAgeSeconds: 60 });
assert.equal(verifySessionToken(token, 'session-secret', { now: 30_000 })?.username, 'admin');
assert.equal(verifySessionToken(token, 'session-secret', { now: 61_000 }), null);
assert.equal(verifySessionToken(`${token}x`, 'session-secret'), null);

const previousNodeEnv = process.env.NODE_ENV;
const previousSecret = process.env.ADMIN_SESSION_SECRET;
try {
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_SESSION_SECRET;
  assert.throws(() => createSessionToken('admin'), /ADMIN_SESSION_SECRET/);
  assert.throws(() => verifySessionToken(token), /ADMIN_SESSION_SECRET/);
} finally {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = previousSecret;
}

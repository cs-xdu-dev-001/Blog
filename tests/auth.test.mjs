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

const token = createSessionToken('admin', 'session-secret');
assert.equal(verifySessionToken(token, 'session-secret')?.username, 'admin');
assert.equal(verifySessionToken(`${token}x`, 'session-secret'), null);

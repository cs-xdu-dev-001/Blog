import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAuthAttemptLimiter,
  getClientIp,
} from '../src/lib/server/authAttemptLimiter.mjs';

function request(headers = {}) {
  return new Request('https://blog.kards.asia/test', { headers });
}

test('forwarded client IP is accepted only behind a trusted proxy', () => {
  const proxied = request({
    'x-real-ip': '203.0.113.8',
    'x-forwarded-for': '198.51.100.4, 203.0.113.8',
  });
  assert.equal(getClientIp(proxied, { trustProxy: true }), '203.0.113.8');
  assert.equal(getClientIp(proxied, { trustProxy: false }), 'local');
  assert.equal(getClientIp(request({ 'x-real-ip': 'not-an-ip' }), { trustProxy: true }), 'local');
});

test('authentication attempts are consumed atomically per client and subject', async () => {
  const limiter = createAuthAttemptLimiter({
    points: 2,
    durationSeconds: 60,
    blockSeconds: 120,
    keyPrefix: 'test',
    resolveClientIp: (value) => value,
  });

  assert.deepEqual(await limiter.consume('client-a', 'note-1'), { allowed: true, retryAfter: 0 });
  assert.deepEqual(await limiter.consume('client-a', 'note-1'), { allowed: true, retryAfter: 0 });
  const blocked = await limiter.consume('client-a', 'note-1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
  assert.equal((await limiter.consume('client-b', 'note-1')).allowed, true);
  assert.equal((await limiter.consume('client-a', 'note-2')).allowed, true);

  await limiter.reset('client-a', 'note-1');
  assert.deepEqual(await limiter.consume('client-a', 'note-1'), { allowed: true, retryAfter: 0 });
});

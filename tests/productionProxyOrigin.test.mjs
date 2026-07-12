import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeApp } from 'astro/app/node';
import astroConfig from '../astro.config.mjs';

test('production proxy preserves the public HTTPS origin for CSRF checks', () => {
  const allowedDomains = astroConfig.security?.allowedDomains ?? [];
  assert.deepEqual(allowedDomains, [
    { protocol: 'https', hostname: 'blog.kards.asia' },
  ]);

  const request = NodeApp.createRequest({
    method: 'GET',
    url: '/admin/login',
    headers: {
      host: 'blog.kards.asia',
      'x-forwarded-host': 'blog.kards.asia',
      'x-forwarded-proto': 'https',
    },
    socket: {
      encrypted: false,
      remoteAddress: '127.0.0.1',
    },
  }, { allowedDomains });

  assert.equal(new URL(request.url).origin, 'https://blog.kards.asia');
});

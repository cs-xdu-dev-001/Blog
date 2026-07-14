import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeApp } from 'astro/app/node';
import astroConfig from '../astro.config.mjs';

test('production proxy preserves the public HTTPS origin for CSRF checks', () => {
  const allowedDomains = astroConfig.security?.allowedDomains ?? [];
  assert.deepEqual(allowedDomains, [
    { protocol: 'https', hostname: 'lajiyuming.tech' },
    { protocol: 'https', hostname: 'blog.lajiyuming.tech' },
  ]);

  for (const hostname of ['lajiyuming.tech', 'blog.lajiyuming.tech']) {
    const request = NodeApp.createRequest({
      method: 'GET',
      url: '/admin/login',
      headers: {
        host: hostname,
        'x-forwarded-host': hostname,
        'x-forwarded-proto': 'https',
      },
      socket: {
        encrypted: false,
        remoteAddress: '127.0.0.1',
      },
    }, { allowedDomains });

    assert.equal(new URL(request.url).origin, `https://${hostname}`);
  }
});

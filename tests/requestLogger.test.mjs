import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeRequestLog,
  createRequestLogContext,
  failRequestLog,
} from '../src/lib/server/requestLogger.mjs';

function captureConsole(method, callback) {
  const original = console[method];
  const lines = [];
  console[method] = (line) => lines.push(String(line));
  try {
    callback();
  } finally {
    console[method] = original;
  }
  return lines.map((line) => JSON.parse(line));
}

test('request logger preserves safe request IDs and never logs query values', () => {
  const request = new Request('https://example.test/api/search?q=private-value', {
    headers: { 'x-request-id': 'edge-request-1234' },
  });
  const context = createRequestLogContext(request);
  context.startedAt = performance.now() - 20;
  const previous = process.env.REQUEST_LOG_ALL;
  process.env.REQUEST_LOG_ALL = '1';

  const entries = captureConsole('log', () => {
    completeRequestLog(context, new Response(null, { status: 204 }));
  });

  if (previous === undefined) delete process.env.REQUEST_LOG_ALL;
  else process.env.REQUEST_LOG_ALL = previous;

  assert.equal(entries[0].requestId, 'edge-request-1234');
  assert.equal(entries[0].path, '/api/search');
  assert.equal(JSON.stringify(entries).includes('private-value'), false);
});

test('request logger records slow and failed requests without error messages', () => {
  const context = createRequestLogContext(new Request('https://example.test/admin/posts'));
  context.startedAt = performance.now() - 1500;
  const warnings = captureConsole('warn', () => {
    completeRequestLog(context, new Response(null, { status: 200 }));
  });
  assert.equal(warnings[0].event, 'http_slow_request');

  const errors = captureConsole('error', () => {
    failRequestLog(context, new Error('secret database detail'));
  });
  assert.equal(errors[0].event, 'http_unhandled_error');
  assert.equal(errors[0].errorName, 'Error');
  assert.equal(JSON.stringify(errors).includes('secret database detail'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { streamAssistantText } from '../src/lib/server/assistantService.mjs';

test('generic assistant text stream honors a model override and yields deltas', async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response([
      'data: {"choices":[{"delta":{"content":"第一"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"段"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const chunks = [];
    for await (const event of streamAssistantText({
      config: {
        assistant: {
          apiBaseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'public-model',
          apiMode: 'chat',
        },
      },
      model: 'gpt-5.5',
      systemText: 'system',
      messages: [{ role: 'user', content: 'user' }],
    })) {
      chunks.push(event);
    }

    assert.equal(body.model, 'gpt-5.5');
    assert.equal(body.stream, true);
    assert.deepEqual(chunks, [
      { type: 'delta', text: '第一' },
      { type: 'delta', text: '段' },
      { type: 'done', text: '第一段' },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

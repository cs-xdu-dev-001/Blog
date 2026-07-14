import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { encodeAssistantSse } from '../src/lib/server/assistantService.mjs';

test('assistant SSE encoder emits named JSON events', () => {
  assert.equal(
    encodeAssistantSse({ event: 'delta', data: { text: '你好' } }),
    'event: delta\ndata: {"text":"你好"}\n\n',
  );
});

test('assistant API streams service events and keeps preflight failures as JSON', () => {
  const source = fs.readFileSync(new URL('../src/pages/api/assistant.ts', import.meta.url), 'utf8');
  assert.match(source, /assistantService\.streamAnswer/);
  assert.match(source, /new ReadableStream/);
  assert.match(source, /text\/event-stream; charset=utf-8/);
  assert.match(source, /no-cache, no-transform/);
  assert.match(source, /['"]X-Accel-Buffering['"]:\s*['"]no/);
  assert.match(source, /Response\.json\(result\.body/);
  assert.match(source, /result\.cancel/);
  assert.match(source, /catch\s*\{/);
  assert.match(source, /code:\s*['"]INTERNAL_ERROR/);
});

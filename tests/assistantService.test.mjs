import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAssistantService, testAssistantConfig } from '../src/lib/server/assistantService.mjs';
import { createPostRepository } from '../src/lib/server/postRepository.mjs';
import { createSiteConfigRepository } from '../src/lib/server/siteConfigRepository.mjs';

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-assistant-')), 'blog.sqlite');
}

function requestWithIp(ip = '127.0.0.1') {
  return new Request('http://localhost/api/assistant', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

function createIsolatedAssistant(dbPath, overrides = {}) {
  const posts = createPostRepository({ dbPath });
  const site = createSiteConfigRepository({ dbPath });
  const assistant = createAssistantService({
    dbPath,
    posts,
    siteConfig: site,
    getReading: () => [],
    getWatch: () => ({ items: [] }),
    ...overrides,
  });
  return { posts, site, assistant };
}

test('assistant searches public blog content', () => {
  const { posts, site, assistant } = createIsolatedAssistant(tempDbPath());

  posts.create({
    title: 'RAG workflow note',
    description: 'Notion, Markdown and retrieval notes',
    category: 'AI Knowledge',
    body: 'This note records how to turn Notion pages into RAG searchable content.',
    published: true,
  });

  const sources = assistant.search('How does RAG work with Notion?', site.getSiteConfig());
  assert.equal(sources[0].title, 'RAG workflow note');
  assert.equal(sources[0].typeLabel, 'note');
});

test('assistant allows general chat fallback and still rate limits', async () => {
  const { site, assistant } = createIsolatedAssistant(tempDbPath());

  site.updateSiteConfig({
    assistant: {
      dailyLimit: 2,
      minuteLimit: 2,
      modules: {
        posts: true,
        reading: false,
        watch: false,
        about: false,
      },
    },
  });

  const general = await assistant.answer('Tell me a short joke', requestWithIp('10.0.0.1'));
  assert.equal(general.status, 200);
  assert.equal(general.body.refused, false);
  assert.match(general.body.answer, /Tell me a short joke/);

  const first = await assistant.answer('RAG', requestWithIp('10.0.0.2'));
  const second = await assistant.answer('RAG', requestWithIp('10.0.0.2'));
  const third = await assistant.answer('RAG', requestWithIp('10.0.0.2'));

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
});

test('assistant prefers exact watch title matches with punctuation differences', () => {
  const dbPath = tempDbPath();
  const { site, assistant } = createIsolatedAssistant(dbPath, {
    getWatch: () => ({
      items: [
        {
          title: 'Hello, Li Huanying',
          type: 'movie',
          status: 'watched',
          rating: '',
          line: 'A movie note about family memory.',
          lineSource: 'personal note',
        },
      ],
    }),
  });

  const sources = assistant.search('What movie is Hello Li Huanying?', site.getSiteConfig());
  assert.equal(sources[0].title, 'Hello, Li Huanying');
  assert.equal(sources[0].typeLabel, 'watch');
});

test('assistant can call responses-compatible endpoint', async () => {
  const { site, assistant } = createIsolatedAssistant(tempDbPath());
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ output_text: 'ok from responses' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    site.updateSiteConfig({
      assistant: {
        apiBaseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        apiMode: 'responses',
      },
    });
    const result = await assistant.answer('hello', requestWithIp('10.0.0.3'));
    assert.equal(result.status, 200);
    assert.equal(result.body.answer, 'ok from responses');
    assert.equal(calls[0].url, 'https://example.com/v1/responses');
    assert.equal(calls[0].body.model, 'test-model');
    assert.equal(calls[0].body.max_output_tokens > 0, true);
    assert.equal(calls[0].body.stream, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('assistant config test uses selected endpoint without returning api key', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body), dispatcher: options.dispatcher });
    return new Response(JSON.stringify({ output_text: 'OK' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await testAssistantConfig({
      apiBaseUrl: 'https://example.com/v1',
      apiKey: 'secret-key',
      model: 'test-model',
      apiMode: 'responses',
      proxyUrl: 'http://127.0.0.1:7890',
    });

    assert.equal(result.ok, true);
    assert.equal(result.endpoint, 'https://example.com/v1/responses');
    assert.equal(result.mode, 'responses');
    assert.equal(result.model, 'test-model');
    assert.equal(result.proxy, 'http://127.0.0.1:7890');
    assert.equal(JSON.stringify(result).includes('secret-key'), false);
    assert.equal(calls[0].headers.Authorization, 'Bearer secret-key');
    assert.equal(calls[0].body.model, 'test-model');
    assert.equal(calls[0].body.stream, true);
    assert.ok(calls[0].dispatcher);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('assistant parses responses stream events', async () => {
  const { site, assistant } = createIsolatedAssistant(tempDbPath());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response([
    'event: response.output_text.delta',
    'data: {"type":"response.output_text.delta","delta":"你"}',
    '',
    'event: response.output_text.delta',
    'data: {"type":"response.output_text.delta","delta":"好"}',
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

  try {
    site.updateSiteConfig({
      assistant: {
        apiBaseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        apiMode: 'responses',
      },
    });
    const result = await assistant.answer('hello', requestWithIp('10.0.0.4'));
    assert.equal(result.status, 200);
    assert.equal(result.body.answer, '你好');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('assistant does not duplicate cumulative responses stream text', async () => {
  const { site, assistant } = createIsolatedAssistant(tempDbPath());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response([
    'data: {"type":"response.output_text.done","output_text":"你好！"}',
    '',
    'data: {"type":"response.completed","response":{"output_text":"你好！有什么可以帮你的吗？"}}',
    '',
    'data: [DONE]',
    '',
  ].join('\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });

  try {
    site.updateSiteConfig({
      assistant: {
        apiBaseUrl: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        apiMode: 'responses',
      },
    });
    const result = await assistant.answer('你好', requestWithIp('10.0.0.5'));
    assert.equal(result.status, 200);
    assert.equal(result.body.answer, '你好！有什么可以帮你的吗？');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

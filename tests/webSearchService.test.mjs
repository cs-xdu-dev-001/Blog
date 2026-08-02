import assert from 'node:assert/strict';
import test from 'node:test';
import { searchWeb, shouldUseWebSearch } from '../src/lib/server/webSearchService.mjs';

const config = {
  assistant: {
    webSearch: {
      enabled: true,
      apiKey: 'tvly-test',
      maxResults: 3,
    },
  },
};

test('web search runs for general questions without site matches and explicit lookup requests', () => {
  assert.equal(shouldUseWebSearch('解释一下量子纠缠', [], config), true);
  assert.equal(shouldUseWebSearch('你好', [], config), false);
  assert.equal(shouldUseWebSearch('总结这篇站内笔记', [{ title: '站内笔记' }], config), false);
  assert.equal(shouldUseWebSearch('查一下今天的AI新闻', [{ title: '站内笔记' }], config), true);
  assert.equal(shouldUseWebSearch('查一下今天的AI新闻', [], { assistant: { webSearch: { enabled: false } } }), false);
});

test('web search uses the fixed Tavily endpoint and normalizes safe sources', async () => {
  const calls = [];
  const sources = await searchWeb('Astro最新版本', config, {
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options, body: JSON.parse(options.body) });
      return Response.json({
        results: [
          {
            title: 'Astro releases',
            url: 'https://astro.build/blog/',
            content: 'Astro release notes and current version.',
            raw_content: '# Astro releases\n\nCurrent release details.',
            score: 0.92,
          },
          { title: 'Unsafe', url: 'javascript:alert(1)', content: 'ignore me' },
        ],
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.tavily.com/search');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer tvly-test');
  assert.equal(calls[0].body.search_depth, 'basic');
  assert.equal(calls[0].body.include_raw_content, 'markdown');
  assert.equal(calls[0].body.max_results, 3);
  assert.deepEqual(sources, [{
    type: 'web',
    typeLabel: '联网',
    title: 'Astro releases',
    url: 'https://astro.build/blog/',
    excerpt: 'Astro releases Current release details.',
    score: 0.92,
  }]);
});

test('web search fails closed without breaking the assistant request', async () => {
  const sources = await searchWeb('test', config, {
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });
  assert.deepEqual(sources, []);
});

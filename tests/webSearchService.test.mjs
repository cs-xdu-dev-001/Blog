import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planAssistantRetrieval,
  searchWeb,
  shouldUseWebSearch,
} from '../src/lib/server/webSearchService.mjs';

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

test('web search does not handle server-known current date and time questions', () => {
  assert.equal(shouldUseWebSearch('今天几月几号？', [], config), false);
  assert.equal(shouldUseWebSearch('今天星期几', [], config), false);
  assert.equal(shouldUseWebSearch('现在几点了', [], config), false);
  assert.equal(shouldUseWebSearch('查一下今天的AI新闻', [], config), true);
});

test('retrieval planner separates local, official, web, time, and chat intents', () => {
  const localSources = [{ title: '站内RAG笔记' }];
  assert.deepEqual(planAssistantRetrieval('今天星期几', [], config), {
    intent: 'server_time',
    useWeb: false,
    includeLocal: false,
    domains: [],
  });
  assert.equal(planAssistantRetrieval('总结这篇站内笔记', localSources, config).intent, 'local');
  assert.equal(planAssistantRetrieval('总结这篇站内笔记', localSources, config).includeLocal, true);
  assert.deepEqual(planAssistantRetrieval('OpenAI最新模型是什么', localSources, config).domains, ['openai.com']);
  assert.equal(planAssistantRetrieval('OpenAI最新模型是什么', localSources, config).includeLocal, false);
  assert.equal(planAssistantRetrieval('解释一下量子纠缠', [], config).intent, 'web');
  assert.equal(planAssistantRetrieval('你好', [], config).intent, 'chat');
});

test('official product routing applies extensible authority domains', () => {
  assert.deepEqual(planAssistantRetrieval('Astro最新版本', [], config).domains, ['astro.build']);
  assert.deepEqual(planAssistantRetrieval('GitHub Actions怎么配置', [], config).domains, ['docs.github.com', 'github.com']);
  assert.deepEqual(planAssistantRetrieval('Node.js最新LTS', [], config).domains, ['nodejs.org']);
  assert.deepEqual(planAssistantRetrieval('binary tree node是什么', [], config).domains, []);
});

test('retrieval planner uses local confidence instead of any incidental match', () => {
  const weakLocal = [{ title: '偶然命中', score: 7 }];
  const usefulLocal = [{ title: '相关笔记', score: 18 }];
  const exactLocal = [{ title: '目标笔记', score: 80 }];

  assert.deepEqual(planAssistantRetrieval('binary tree node是什么', weakLocal, config), {
    intent: 'web',
    useWeb: true,
    includeLocal: false,
    domains: [],
  });
  assert.deepEqual(planAssistantRetrieval('量子纠缠是什么', usefulLocal, config), {
    intent: 'hybrid',
    useWeb: true,
    includeLocal: true,
    domains: [],
  });
  assert.equal(planAssistantRetrieval('总结目标笔记', exactLocal, config).intent, 'local');
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
  assert.equal(calls[0].body.search_depth, 'advanced');
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

test('OpenAI product searches only keep official OpenAI sources', async () => {
  const calls = [];
  const sources = await searchWeb('openai的最新模型是啥', config, {
    fetchImpl: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return Response.json({
        results: [
          {
            title: 'Models',
            url: 'https://developers.openai.com/api/docs/models',
            raw_content: 'Official current model documentation.',
            score: 0.95,
          },
          {
            title: '转载文章',
            url: 'https://example.cn/openai-models',
            raw_content: 'Outdated model list.',
            score: 0.99,
          },
        ],
      });
    },
  });

  assert.deepEqual(calls[0].include_domains, ['openai.com']);
  assert.equal(calls[0].search_depth, 'advanced');
  assert.match(calls[0].query, /official documentation/i);
  assert.deepEqual(sources.map((source) => source.url), [
    'https://developers.openai.com/api/docs/models',
  ]);
});

test('web search reranks relevance, removes duplicates, and returns at most three sources', async () => {
  const sources = await searchWeb('量子纠缠是什么', config, {
    fetchImpl: async () => Response.json({
      results: [
        { title: '高分但无关', url: 'https://noise.example/a', raw_content: '今日体育赛事。', score: 0.98 },
        { title: '量子纠缠解释', url: 'https://science.example/entanglement?utm_source=x', raw_content: '量子纠缠的基本原理。', score: 0.62 },
        { title: '量子纠缠解释副本', url: 'https://science.example/entanglement?ref=copy', raw_content: '重复页面。', score: 0.8 },
        { title: '量子力学基础', url: 'https://physics.example/quantum', raw_content: '包含量子纠缠。', score: 0.58 },
        { title: '纠缠实验', url: 'https://lab.example/result', raw_content: '实验验证量子纠缠。', score: 0.55 },
      ],
    }),
  });

  assert.equal(sources.length, 3);
  assert.equal(sources[0].url.startsWith('https://science.example/entanglement'), true);
  assert.equal(sources.filter((source) => source.url.includes('/entanglement')).length, 1);
  assert.equal(sources.some((source) => source.title === '高分但无关'), false);
});

test('web search fails closed without breaking the assistant request', async () => {
  const sources = await searchWeb('test', config, {
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });
  assert.deepEqual(sources, []);
});

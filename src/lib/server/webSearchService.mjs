const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const explicitWebPattern = /(?:联网|网上|搜索|搜一下|查一下|查查|最新|今日|今天|实时|新闻|价格|天气|汇率|官网|链接|look\s*up|search|latest|current|today|news|price|weather)/i;
const factualQuestionPattern = /(?:是什么|为什么|怎么|如何|谁|哪里|哪年|多少|介绍|解释|比较|推荐|what|why|how|who|where|when|explain|compare|recommend)/i;
const serverKnownTimePattern = /(?:(?:今天|今日|现在|当前).{0,8}(?:几月|几号|日期|星期|周几|几点|时间)|几月几号|what\s+(?:day|date|time).{0,12}(?:today|now)|what\s+time\s+is\s+it)/i;
const localIntentPattern = /(?:本站|站内|博客|博主|我的|这篇笔记|书架|影像档案|美食|主线)/i;
const freshnessPattern = /(?:最新|今日|今天|实时|新闻|价格|版本|发布|latest|current|today|news|release|version)/i;
const authorityProfiles = [
  { pattern: /(?:\bopenai\b|\bchatgpt\b|\bgpt(?:[-\s]?\d|[-\s]?oss)?\b)/i, domains: ['openai.com'] },
  { pattern: /\bastro(?:\.js)?\b/i, domains: ['astro.build'] },
  { pattern: /\bgithub\b/i, domains: ['docs.github.com', 'github.com'] },
  { pattern: /\bnode(?:\.?js)?\b/i, domains: ['nodejs.org'] },
  { pattern: /\btypescript\b/i, domains: ['typescriptlang.org'] },
  { pattern: /\bvite\b/i, domains: ['vite.dev'] },
];

function webSearchConfig(config = {}) {
  return config.assistant?.webSearch || {};
}

function webSearchApiKey(config = {}) {
  return String(webSearchConfig(config).apiKey || process.env.TAVILY_API_KEY || '').trim();
}

function cleanExcerpt(value, maxLength = 1200) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[#>*+\-\d.\s]+/gm, '')
    .replace(/[*_`~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeWebUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function limitedResultCount(config = {}) {
  return Math.max(1, Math.min(5, Number(webSearchConfig(config).maxResults) || 4));
}

function authorityProfile(question) {
  const text = String(question || '');
  return authorityProfiles.find((profile) => profile.pattern.test(text)) || null;
}

export function planAssistantRetrieval(question, localSources = [], config = {}) {
  const text = String(question || '').trim();
  const webReady = webSearchConfig(config).enabled === true && Boolean(webSearchApiKey(config));
  const profile = authorityProfile(text);
  const result = (intent, useWeb, includeLocal, domains = []) => ({
    intent,
    useWeb,
    includeLocal,
    domains,
  });

  if (!text) return result('chat', false, false);
  if (serverKnownTimePattern.test(text)) return result('server_time', false, false);
  if (localSources.length && localIntentPattern.test(text)) return result('local', false, true);
  if (profile) return result('official', webReady, false, profile.domains);
  if (explicitWebPattern.test(text) || /https?:\/\//i.test(text)) return result('web', webReady, false);
  if (localSources.length) return result('local', false, true);
  if (factualQuestionPattern.test(text)) return result('web', webReady, false);
  return result('chat', false, false);
}

export function shouldUseWebSearch(question, localSources = [], config = {}) {
  return planAssistantRetrieval(question, localSources, config).useWeb;
}

export function isServerKnownTimeQuestion(question) {
  return serverKnownTimePattern.test(String(question || '').trim());
}

export function shouldPreferOfficialWebSources(question) {
  return Boolean(authorityProfile(question));
}

function webSearchProfile(question) {
  const text = String(question || '').replaceAll('\0', '').trim().slice(0, 400);
  const profile = authorityProfile(text);
  if (!profile) {
    return {
      query: text,
      domains: [],
      searchDepth: freshnessPattern.test(text) ? 'advanced' : 'basic',
    };
  }
  return {
    query: `${text} official documentation`,
    domains: profile.domains,
    searchDepth: 'advanced',
  };
}

function matchesAllowedDomain(url, domains) {
  if (!domains.length) return true;
  const hostname = new URL(url).hostname.toLowerCase();
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function canonicalWebUrl(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

function relevanceTokens(value) {
  const text = String(value || '').toLowerCase();
  const latin = text.match(/[a-z0-9][a-z0-9.+#-]{1,}/g) || [];
  const cjk = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const pairs = cjk.flatMap((chunk) => Array.from(
    { length: Math.max(0, chunk.length - 1) },
    (_, index) => chunk.slice(index, index + 2),
  ));
  const weak = new Set(['什么', '怎么', '如何', '一下', '介绍', '解释', '最新', '官方', 'today', 'latest', 'current']);
  return [...new Set([...latin, ...pairs])].filter((token) => !weak.has(token)).slice(0, 24);
}

function freshnessScore(question, publishedDate) {
  if (!freshnessPattern.test(String(question || '')) || !publishedDate) return 0;
  const timestamp = Date.parse(publishedDate);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
  if (ageDays <= 365) return 16;
  if (ageDays <= 1095) return 8;
  if (ageDays > 1825) return -16;
  return 0;
}

function rankWebResults(question, results, profile, limit) {
  const tokens = relevanceTokens(question);
  const ranked = (Array.isArray(results) ? results : []).map((result) => {
    const url = safeWebUrl(result?.url);
    const excerpt = cleanExcerpt(result?.raw_content || result?.content);
    if (!url || !excerpt || !matchesAllowedDomain(url, profile.domains)) return null;
    const title = String(result?.title || new URL(url).hostname).trim().slice(0, 160);
    const lowerTitle = title.toLowerCase();
    const lowerExcerpt = excerpt.toLowerCase();
    const titleHits = tokens.filter((token) => lowerTitle.includes(token)).length;
    const excerptHits = tokens.filter((token) => lowerExcerpt.includes(token)).length;
    const providerScore = Math.max(0, Math.min(1, Number(result?.score || 0))) * 60;
    const authorityScore = profile.domains.length ? 24 : 0;
    const noMatchPenalty = titleHits + excerptHits === 0 ? -18 : 0;
    const rank = providerScore
      + Math.min(42, titleHits * 12 + excerptHits * 4)
      + authorityScore
      + freshnessScore(question, result?.published_date)
      + noMatchPenalty;
    return {
      canonicalUrl: canonicalWebUrl(url),
      rank,
      source: {
        type: 'web',
        typeLabel: '联网',
        title,
        url,
        excerpt,
        score: Number(result?.score || 0),
      },
    };
  }).filter(Boolean).sort((left, right) => right.rank - left.rank);

  const unique = [];
  const seen = new Set();
  for (const item of ranked) {
    if (seen.has(item.canonicalUrl)) continue;
    seen.add(item.canonicalUrl);
    unique.push(item.source);
    if (unique.length >= limit) break;
  }
  return unique;
}

export async function searchWeb(question, config = {}, {
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 8000,
  maxResponseChars = 1000000,
} = {}) {
  const apiKey = webSearchApiKey(config);
  if (webSearchConfig(config).enabled !== true || !apiKey || typeof fetchImpl !== 'function') return [];
  const profile = webSearchProfile(question);

  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  signal?.addEventListener('abort', abortFromParent, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 8000));

  try {
    const response = await fetchImpl(TAVILY_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: profile.query,
        topic: 'general',
        search_depth: profile.searchDepth,
        max_results: limitedResultCount(config),
        include_answer: false,
        include_raw_content: 'markdown',
        include_images: false,
        ...(profile.domains.length ? { include_domains: profile.domains } : {}),
      }),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const text = await response.text();
    if (!text || text.length > maxResponseChars) return [];
    const data = JSON.parse(text);
    return rankWebResults(
      question,
      data.results,
      profile,
      Math.min(3, limitedResultCount(config)),
    );
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  }
}

export async function testWebSearchConfig(assistantInput = {}, options = {}) {
  const config = { assistant: { webSearch: assistantInput.webSearch || {} } };
  if (config.assistant.webSearch.enabled !== true) return { enabled: false, ok: true, resultCount: 0 };
  if (!webSearchApiKey(config)) {
    return { enabled: true, ok: false, resultCount: 0, error: 'Tavily API Key为空' };
  }
  const sources = await searchWeb('OpenAI official website', config, options);
  return sources.length
    ? { enabled: true, ok: true, resultCount: sources.length }
    : { enabled: true, ok: false, resultCount: 0, error: '联网搜索没有返回结果' };
}

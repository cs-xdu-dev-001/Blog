const TAVILY_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const explicitWebPattern = /(?:联网|网上|搜索|搜一下|查一下|查查|最新|今日|今天|实时|新闻|价格|天气|汇率|官网|链接|look\s*up|search|latest|current|today|news|price|weather)/i;
const factualQuestionPattern = /(?:是什么|为什么|怎么|如何|谁|哪里|哪年|多少|介绍|解释|比较|推荐|what|why|how|who|where|when|explain|compare|recommend)/i;

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

export function shouldUseWebSearch(question, localSources = [], config = {}) {
  if (webSearchConfig(config).enabled !== true || !webSearchApiKey(config)) return false;
  const text = String(question || '').trim();
  if (!text) return false;
  if (explicitWebPattern.test(text) || /https?:\/\//i.test(text)) return true;
  return localSources.length === 0 && factualQuestionPattern.test(text);
}

export async function searchWeb(question, config = {}, {
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 8000,
  maxResponseChars = 1000000,
} = {}) {
  const apiKey = webSearchApiKey(config);
  if (webSearchConfig(config).enabled !== true || !apiKey || typeof fetchImpl !== 'function') return [];

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
        query: String(question || '').replaceAll('\0', '').trim().slice(0, 400),
        topic: 'general',
        search_depth: 'basic',
        max_results: limitedResultCount(config),
        include_answer: false,
        include_raw_content: 'markdown',
        include_images: false,
      }),
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const text = await response.text();
    if (!text || text.length > maxResponseChars) return [];
    const data = JSON.parse(text);
    return (Array.isArray(data.results) ? data.results : [])
      .map((result) => {
        const url = safeWebUrl(result?.url);
        const excerpt = cleanExcerpt(result?.raw_content || result?.content);
        if (!url || !excerpt) return null;
        return {
          type: 'web',
          typeLabel: '联网',
          title: String(result?.title || new URL(url).hostname).trim().slice(0, 160),
          url,
          excerpt,
          score: Number(result?.score || 0),
        };
      })
      .filter(Boolean)
      .slice(0, limitedResultCount(config));
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

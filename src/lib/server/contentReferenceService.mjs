import { foodRepository } from './foodRepository.mjs';
import { postRepository } from './postRepository.mjs';
import { readingRepository } from './readingRepository.mjs';
import { siteConfigRepository } from './siteConfigRepository.mjs';
import { watchRepository } from './watchRepository.mjs';

const typeLabels = {
  post: '笔记',
  topic: '主线',
  reading: '书籍',
  watch: '影像',
  food: '美食',
};

function text(value) {
  return String(value || '').trim();
}

function normalizedQuery(value) {
  return text(value).toLocaleLowerCase('zh-CN').slice(0, 100);
}

function matchesQuery(item, query) {
  if (!query) return false;
  return [item.title, item.subtitle]
    .some((value) => text(value).toLocaleLowerCase('zh-CN').includes(query));
}

function normalizeTargetUrl(value) {
  const target = text(value);
  if (!target.startsWith('/') || target.startsWith('//')) return '';
  if (/[\s<>"'\\]/.test(target)) return '';
  return target.split(/[?#]/, 1)[0];
}

function markdownDestinations(markdown) {
  const destinations = [];
  const pattern = /\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of String(markdown || '').matchAll(pattern)) {
    const target = normalizeTargetUrl(match[1]);
    if (target) destinations.push(target);
  }
  return destinations;
}

function reference(type, title, subtitle, url) {
  return {
    type,
    typeLabel: typeLabels[type],
    title: text(title),
    subtitle: text(subtitle),
    url,
  };
}

function safeItems(read) {
  try {
    return read()?.items || [];
  } catch {
    return [];
  }
}

export function createContentReferenceService({
  postRepository: posts = postRepository,
  siteConfigRepository: siteConfig = siteConfigRepository,
  readingRepository: reading = readingRepository,
  watchRepository: watch = watchRepository,
  foodRepository: food = foodRepository,
} = {}) {
  function publishedPosts(query = '') {
    return safeItems(() => posts.list({ query, filter: 'published', limit: 1000 }))
      .filter((item) => item?.data?.published !== false && !item?.locked);
  }

  return {
    search(queryInput = '', { limit = 8 } = {}) {
      const query = normalizedQuery(queryInput);
      if (!query) return [];

      let topics = [];
      try {
        topics = siteConfig.getSiteConfig()?.topics?.cards || [];
      } catch {
        topics = [];
      }

      const results = [
        ...publishedPosts(query).map((item) => reference(
          'post',
          item.data?.title,
          item.data?.description,
          `/posts/${item.slug}`,
        )),
        ...topics.map((item) => reference(
          'topic',
          item.title,
          item.meta || item.text,
          item.href || `/topics/${item.slug}`,
        )),
        ...safeItems(() => reading.list({
          query: queryInput,
          limit: 100,
          publishedOnly: true,
        }))
          .filter((item) => item.published !== false)
          .map((item) => reference(
            'reading',
            item.title,
            item.author,
            `/reading/${item.slug}`,
          )),
        ...safeItems(() => watch.list({ query: queryInput, limit: 100 }))
          .map((item) => reference(
            'watch',
            item.title,
            [item.type, item.status].filter(Boolean).join(' · '),
            `/watch/${item.id}`,
          )),
        ...safeItems(() => food.list({
          query: queryInput,
          limit: 100,
          publishedOnly: true,
        }))
          .filter((item) => item.published !== false)
          .map((item) => reference(
            'food',
            item.title,
            item.dish || item.area,
            `/food/${item.id}`,
          )),
      ].filter((item) => item.title && item.url && matchesQuery(item, query));

      return results.slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)));
    },

    backlinks(targetInput, { limit = 8 } = {}) {
      const target = normalizeTargetUrl(targetInput);
      if (!target) return [];
      return publishedPosts()
        .filter((item) => markdownDestinations(item.body).includes(target))
        .slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)))
        .map((item) => ({
          title: text(item.data?.title),
          description: text(item.data?.description),
          url: `/posts/${item.slug}`,
          slug: item.slug,
        }));
    },
  };
}

export const contentReferenceService = createContentReferenceService();

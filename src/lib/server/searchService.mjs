import { postRepository } from './postRepository.mjs';
import { readingRepository } from './readingRepository.mjs';
import { watchRepository } from './watchRepository.mjs';

const GROUP_LIMIT = 6;
const TAG_LIMIT = 4;

function cleanText(value, limit = 180) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function searchable(values) {
  return values.map((value) => String(value || '')).join('\n').toLocaleLowerCase('zh-CN');
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function postResult(item) {
  const category = item.category || item.data?.category || '笔记';
  const tags = Array.isArray(item.tags) ? item.tags : item.data?.tags || [];
  const date = formatDate(item.date || item.data?.date);
  const locked = Boolean(item.locked);
  return {
    id: `post:${item.id ?? item.slug}`,
    type: 'post',
    title: item.title || item.data?.title || '',
    meta: [locked ? '加密' : category, tags.slice(0, 2).map((tag) => `#${tag}`).join(' '), date].filter(Boolean).join(' · '),
    excerpt: locked ? '' : cleanText(item.description || item.data?.description || item.body),
    image: '',
    href: `/posts/${item.slug}`,
    locked,
  };
}

function readingResult(item) {
  return {
    id: `reading:${item.id ?? item.slug}`,
    type: 'reading',
    title: item.title,
    meta: [item.author, item.status_label || item.statusLabel || item.status].filter(Boolean).join(' · '),
    excerpt: cleanText(item.summary || item.quote || item.review),
    image: item.image_small_path || item.image_path || item.coverSmall || item.cover || '',
    href: `/reading/${item.slug}`,
  };
}

function watchResult(item) {
  return {
    id: `watch:${item.id}`,
    type: 'watch',
    title: item.title,
    meta: [item.type, item.status, item.rating ? `${item.rating}分` : ''].filter(Boolean).join(' · '),
    excerpt: cleanText(item.quote || item.comment),
    image: item.image_small_path || item.image_path || item.imageSmall || item.image || '',
    href: `/watch/${item.id}`,
  };
}

function group(key, label, items) {
  return { key, label, items };
}

export function createSearchService({
  posts = postRepository,
  reading = readingRepository,
  watch = watchRepository,
} = {}) {
  function readPublicData() {
    const postItems = posts.list({ filter: 'published', limit: 500 }).items
      .filter((item) => item.published === undefined || Number(item.published) === 1);
    const readingItems = reading.list({ limit: 500, publishedOnly: true }).items;
    const watchItems = watch.list({ limit: 1000 }).items;
    return { postItems, readingItems, watchItems };
  }

  return {
    search(queryInput = '') {
      const query = String(queryInput || '').trim().slice(0, 100);
      const needle = query.toLocaleLowerCase('zh-CN');
      const { postItems, readingItems, watchItems } = readPublicData();

      if (!needle) {
        const groups = [
          group('posts', '笔记', postItems.slice(0, GROUP_LIMIT).map(postResult)),
          group('reading', '书籍', readingItems.filter((item) => item.status === 'reading').slice(0, GROUP_LIMIT).map(readingResult)),
          group('watch', '影像', watchItems.filter((item) => item.status === '在看').slice(0, GROUP_LIMIT).map(watchResult)),
          group('tags', '标签', []),
        ];
        return { query, total: groups.reduce((sum, item) => sum + item.items.length, 0), groups };
      }

      const matchedPosts = postItems.filter((item) => searchable([
        item.title,
        item.data?.title,
        item.locked ? '' : item.description,
        item.locked ? '' : item.data?.description,
        item.category,
        item.data?.category,
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...(Array.isArray(item.data?.tags) ? item.data.tags : []),
        item.locked ? '' : item.body,
      ]).includes(needle));
      const matchedReading = readingItems.filter((item) => searchable([
        item.title,
        item.author,
        item.status,
        item.status_label,
        item.summary,
        item.quote,
        item.review,
      ]).includes(needle));
      const matchedWatch = watchItems.filter((item) => searchable([
        item.title,
        item.type,
        item.status,
        item.rating,
        item.quote,
        item.comment,
      ]).includes(needle));

      const categories = new Map();
      postItems.forEach((item) => {
        const category = String(item.category || item.data?.category || '').trim();
        const tags = Array.isArray(item.tags) && item.tags.length
          ? item.tags
          : Array.isArray(item.data?.tags) && item.data.tags.length
            ? item.data.tags
            : [category].filter(Boolean);
        tags.forEach((tag) => {
          const label = String(tag || '').trim();
          if (!label) return;
          const key = label.toLocaleLowerCase('zh-CN');
          if (!categories.has(key)) categories.set(key, { title: label, posts: [] });
          categories.get(key).posts.push(item);
        });
      });
      const matchedTags = [...categories.entries()]
        .filter(([key]) => key.includes(needle))
        .slice(0, TAG_LIMIT)
        .map(([key, value]) => ({
          id: `tag:${key}`,
          type: 'tag',
          title: value.title,
          meta: `${value.posts.length}篇笔记`,
          excerpt: '',
          image: '',
          href: '',
          children: value.posts.slice(0, GROUP_LIMIT).map(postResult),
        }));

      const groups = [
        group('posts', '笔记', matchedPosts.slice(0, GROUP_LIMIT).map(postResult)),
        group('reading', '书籍', matchedReading.slice(0, GROUP_LIMIT).map(readingResult)),
        group('watch', '影像', matchedWatch.slice(0, GROUP_LIMIT).map(watchResult)),
        group('tags', '标签', matchedTags),
      ];
      return { query, total: groups.reduce((sum, item) => sum + item.items.length, 0), groups };
    },
  };
}

export const searchService = createSearchService();

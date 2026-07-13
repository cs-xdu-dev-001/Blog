import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSearchService } from '../src/lib/server/searchService.mjs';

function createService() {
  const postItems = [
    { id: 1, slug: 'ai-note', title: 'AI时代的学习路径', description: '理解模型与知识系统。', category: 'AI Knowledge', body: 'Notion和Agent实践。', date: '2026-07-13', published: 1 },
    { id: 2, slug: 'rag-note', title: 'Notion到RAG', description: '把知识接入检索。', category: 'AI Knowledge', body: 'RAG工作流。', date: '2026-07-12', published: 1 },
    { id: 3, slug: 'draft-note', title: 'draft note', description: '不能公开', category: 'AI Knowledge', body: '', date: '2026-07-11', published: 0 },
    ...Array.from({ length: 8 }, (_, index) => ({
      id: index + 10,
      slug: `automation-${index}`,
      title: `自动化笔记${index}`,
      description: '自动化内容',
      category: 'Automation',
      body: '',
      date: `2026-06-${String(20 - index).padStart(2, '0')}`,
      published: 1,
    })),
  ];
  const readingItems = [
    { id: 1, slug: 'wave-top', title: '浪潮之巅', author: '吴军', status: 'reading', status_label: '在读', summary: '科技产业史', quote: '', review: 'AI产业变化', image_path: '/reading/wave.jpg' },
    { id: 2, slug: 'three-body', title: '三体', author: '刘慈欣', status: 'read', status_label: '已读', summary: '科幻小说', quote: '', review: '', image_path: '' },
  ];
  const watchItems = [
    { id: 1, title: '主角', type: '剧集', status: '已看', rating: '4.5', quote: '台上繁华', comment: '人物命运', image_path: '/watch/protagonist.jpg', is_activity_featured: 1 },
    { id: 2, title: '大江大河', type: '剧集', status: '在看', rating: '', quote: '', comment: '改革叙事', image_path: '/watch/river.jpg', is_activity_featured: 1 },
  ];

  return createSearchService({
    posts: {
      list({ filter }) {
        assert.equal(filter, 'published');
        return { items: postItems.filter((item) => item.published === 1) };
      },
    },
    reading: { list: () => ({ items: readingItems }) },
    watch: { list: () => ({ items: watchItems }) },
  });
}

test('search service groups public posts, reading, watch, and expandable tags', () => {
  const result = createService().search('AI');

  assert.deepEqual(result.groups.map((group) => group.key), ['posts', 'reading', 'watch', 'tags']);
  assert.equal(result.groups.find((group) => group.key === 'posts').items[0].href, '/posts/ai-note');
  assert.equal(result.groups.find((group) => group.key === 'reading').items[0].href, '/reading/wave-top');
  const tag = result.groups.find((group) => group.key === 'tags').items[0];
  assert.equal(tag.title, 'AI Knowledge');
  assert.equal(tag.children.length, 2);
  assert.equal(JSON.stringify(result).includes('draft note'), false);
});

test('empty search returns recent posts, active reading, and active watch only', () => {
  const result = createService().search('');

  assert.ok(result.groups.find((group) => group.key === 'posts').items.length > 0);
  assert.deepEqual(result.groups.find((group) => group.key === 'reading').items.map((item) => item.title), ['浪潮之巅']);
  assert.deepEqual(result.groups.find((group) => group.key === 'watch').items.map((item) => item.title), ['大江大河']);
  assert.deepEqual(result.groups.find((group) => group.key === 'tags').items, []);
});

test('search service matches watch metadata and caps each result group', () => {
  const service = createService();
  const watch = service.search('剧集').groups.find((group) => group.key === 'watch');
  const posts = service.search('自动化').groups.find((group) => group.key === 'posts');

  assert.deepEqual(watch.items.map((item) => item.title), ['主角', '大江大河']);
  assert.equal(posts.items.length, 6);
});

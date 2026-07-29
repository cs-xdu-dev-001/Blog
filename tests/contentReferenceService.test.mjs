import assert from 'node:assert/strict';
import test from 'node:test';

import { createContentReferenceService } from '../src/lib/server/contentReferenceService.mjs';

function fixtureService() {
  return createContentReferenceService({
    postRepository: {
      list({ query = '' } = {}) {
        const items = [
          {
            slug: 'agent-notes',
            locked: false,
            body: '关联[影像条目](/watch/12)。',
            data: {
              title: 'Agent笔记',
              description: 'Agent系统记录',
              published: true,
            },
          },
          {
            slug: 'locked-note',
            locked: true,
            body: '[影像条目](/watch/12)',
            data: { title: '加密笔记', description: '', published: true },
          },
          {
            slug: 'draft-note',
            locked: false,
            body: '[影像条目](/watch/12)',
            data: { title: '草稿笔记', description: '', published: false },
          },
        ];
        const normalized = String(query).trim().toLowerCase();
        return {
          items: normalized
            ? items.filter((item) => item.data.title.toLowerCase().includes(normalized))
            : items,
        };
      },
    },
    siteConfigRepository: {
      getSiteConfig() {
        return {
          topics: {
            cards: [
              {
                title: 'Agent系统',
                slug: 'agent-system',
                href: '/topics/agent-system',
                meta: 'Memory / Tools',
                text: '长期Agent实践',
              },
            ],
          },
        };
      },
    },
    readingRepository: {
      list() {
        return {
          items: [
            { title: '公开书籍', slug: 'public-book', author: '作者', published: true },
            { title: '未发布书籍', slug: 'draft-book', author: '作者', published: false },
          ],
        };
      },
    },
    watchRepository: {
      list() {
        return { items: [{ id: 12, title: 'Agent电影', type: '电影', status: '已看' }] };
      },
    },
    foodRepository: {
      list() {
        return {
          items: [
            { id: 8, title: '公开餐馆', dish: '面', published: true },
            { id: 9, title: '草稿餐馆', dish: '饭', published: false },
          ],
        };
      },
    },
  });
}

test('searches public reference targets with stable frontend URLs', () => {
  const results = fixtureService().search('Agent', { limit: 10 });
  assert.deepEqual(
    results.map(({ type, title, url }) => ({ type, title, url })),
    [
      { type: 'post', title: 'Agent笔记', url: '/posts/agent-notes' },
      { type: 'topic', title: 'Agent系统', url: '/topics/agent-system' },
      { type: 'watch', title: 'Agent电影', url: '/watch/12' },
    ],
  );
});

test('does not expose unpublished books or food records', () => {
  assert.deepEqual(
    fixtureService().search('公开', { limit: 10 }).map(({ type, url }) => ({ type, url })),
    [
      { type: 'reading', url: '/reading/public-book' },
      { type: 'food', url: '/food/8' },
    ],
  );
});

test('returns only published unlocked notes that reference the canonical target URL', () => {
  assert.deepEqual(
    fixtureService().backlinks('/watch/12').map(({ title, url }) => ({ title, url })),
    [{ title: 'Agent笔记', url: '/posts/agent-notes' }],
  );
});

test('rejects external and malformed backlink targets', () => {
  const service = fixtureService();
  assert.deepEqual(service.backlinks('https://example.com/watch/12'), []);
  assert.deepEqual(service.backlinks(''), []);
});

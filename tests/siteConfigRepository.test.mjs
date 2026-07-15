import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSiteConfigRepository } from '../src/lib/server/siteConfigRepository.mjs';
import { createPostRepository } from '../src/lib/server/postRepository.mjs';

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-site-')), 'blog.sqlite');
}

test('site config repository reads defaults and updates site settings', () => {
  const repo = createSiteConfigRepository({ dbPath: tempDbPath() });

  const defaults = repo.getSiteConfig();
  assert.equal(defaults.brandName, 'Dev Notes');
  assert.equal(defaults.social.github, 'https://github.com/cs-xdu-dev-001');
  assert.equal(defaults.social.monitor, 'https://pulseboard.academicedu.me/');
  assert.equal(defaults.assistant.placeholder, '在Dev Notes中问任何问题');
  assert.equal(defaults.topics.title, '主线');
  assert.equal(defaults.topics.body, '');
  assert.equal(defaults.topics.cards.length, 9);
  assert.equal(defaults.topics.cards[0].title, 'LLM微调');
  assert.equal(defaults.topics.cards[0].slug, 'llm-finetune');
  assert.equal(defaults.topics.cards[0].href, '/topics/llm-finetune');

  const updated = repo.updateSiteConfig({
    brandName: 'Dev Lab',
    heroLine: '新的首页文案',
    social: {
      github: 'https://github.com/example',
      bilibili: 'https://b23.tv/demo',
      qq: '123456',
    },
    topics: {
      cards: [
        {
          title: 'HTTP抓包',
          meta: 'Proxy / TLS',
          text: '看清真实请求链路。',
          level: 6,
          slug: 'http-capture',
        },
      ],
    },
  });

  assert.equal(updated.brandName, 'Dev Lab');
  assert.equal(updated.heroLine, '新的首页文案');
  assert.equal(updated.social.qq, '123456');
  assert.equal(updated.topics.title, '主线');
  assert.equal(updated.topics.body, '');
  assert.deepEqual(updated.topics.cards, [
    {
      title: 'HTTP抓包',
      meta: 'Proxy / TLS',
      text: '看清真实请求链路。',
      level: 6,
      slug: 'http-capture',
      href: '/topics/http-capture',
    },
  ]);
});

test('homepage exposes the monitor dashboard as a configurable external icon link', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../public/admin-site.js', import.meta.url), 'utf8');

  assert.match(homepage, /href=\{siteConfig\.social\.monitor\}/);
  assert.match(homepage, /aria-label="监控仪表盘"/);
  assert.match(homepage, /target="_blank"/);
  assert.match(homepage, /rel="noopener noreferrer"/);
  assert.match(admin, /input\('social\.monitor', '监控仪表盘'/);
  assert.match(admin, /monitor: form\.get\('social\.monitor'\)/);
});

test('homepage topics are configurable from the admin site form', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const admin = fs.readFileSync(new URL('../public/admin-site.js', import.meta.url), 'utf8');

  assert.match(homepage, /siteConfig\.topics/);
  assert.match(homepage, /qzq-topic-row/);
  assert.match(homepage, /qzq-topic-detail/);
  assert.match(homepage, /data-topic-href/);
  assert.match(homepage, /\/topics\/\$\{card\.slug\}/);
  assert.match(homepage, /openTopicHref/);
  assert.doesNotMatch(homepage, /qzq-topic-statement/);
  assert.match(admin, /id="topics-config"/);
  assert.match(admin, /data-topic-card/);
  assert.match(admin, /data-topic-slug/);
  assert.match(admin, /topics: \{/);
  assert.match(admin, /cards: readTopicCards\(\)/);
  assert.doesNotMatch(admin, /topics\.body/);
});

test('topic detail pages and post editor expose topic-post links', () => {
  const topicPage = fs.readFileSync(new URL('../src/pages/topics/[slug].astro', import.meta.url), 'utf8');
  const adminLayout = fs.readFileSync(new URL('../src/layouts/AdminLayout.astro', import.meta.url), 'utf8');
  const adminTopicsPage = fs.readFileSync(new URL('../src/pages/admin/topics.astro', import.meta.url), 'utf8');
  const adminTopicsScript = fs.readFileSync(new URL('../public/admin-topics.js', import.meta.url), 'utf8');
  const adminPostsPage = fs.readFileSync(new URL('../src/pages/admin/posts.astro', import.meta.url), 'utf8');
  const adminPostsScript = fs.readFileSync(new URL('../public/admin-posts.js', import.meta.url), 'utf8');
  const postsApi = fs.readFileSync(new URL('../src/pages/api/admin/posts/index.ts', import.meta.url), 'utf8');
  const editorPage = fs.readFileSync(new URL('../src/pages/admin/posts/[id]/edit.astro', import.meta.url), 'utf8');
  const editorScript = fs.readFileSync(new URL('../public/admin-post-editor.js', import.meta.url), 'utf8');
  const updateApi = fs.readFileSync(new URL('../src/pages/api/admin/posts/[id].ts', import.meta.url), 'utf8');
  const topicsApi = fs.readFileSync(new URL('../src/pages/api/admin/topics/index.ts', import.meta.url), 'utf8');
  const topicApi = fs.readFileSync(new URL('../src/pages/api/admin/topics/[slug].ts', import.meta.url), 'utf8');

  assert.match(topicPage, /Astro\.params\.slug/);
  assert.match(topicPage, /topicSlug:\s*slug/);
  assert.match(topicPage, /\/posts\/\$\{post\.slug\}/);
  assert.match(adminLayout, /href: '\/admin\/topics'/);
  assert.match(adminTopicsPage, /data-topics-admin/);
  assert.match(adminTopicsPage, /data-add-topic/);
  assert.match(adminTopicsPage, /\/admin-topics\.js/);
  assert.match(adminTopicsScript, /\/api\/admin\/site/);
  assert.match(adminTopicsScript, /\/api\/admin\/topics/);
  assert.match(adminTopicsScript, /focusTopicCard/);
  assert.match(adminTopicsScript, /data-add-topic-inline/);
  assert.match(adminTopicsScript, /method:\s*'POST'/);
  assert.match(adminTopicsScript, /method:\s*'PUT'/);
  assert.match(adminTopicsScript, /method:\s*'DELETE'/);
  assert.match(adminPostsPage, /data-post-topic-filters/);
  assert.match(adminPostsScript, /data-post-topic-filter/);
  assert.match(adminPostsScript, /topicSlug/);
  assert.match(postsApi, /topicSlug:\s*url\.searchParams\.get\('topicSlug'\)/);
  assert.match(editorPage, /name="topicSlugs"/);
  assert.match(editorPage, /管理\/新增主线/);
  assert.match(editorPage, /href="\/admin\/topics"/);
  assert.match(editorPage, /siteConfigRepository\.getSiteConfig/);
  assert.match(editorScript, /getAll\('topicSlugs'\)/);
  assert.match(updateApi, /topicSlugs:\s*body\.topicSlugs/);
  assert.match(topicsApi, /createTopic/);
  assert.match(topicApi, /updateTopic/);
  assert.match(topicApi, /deleteTopic/);
});

test('site config repository performs topic CRUD and keeps post links consistent', () => {
  const dbPath = tempDbPath();
  const siteRepo = createSiteConfigRepository({ dbPath });
  const postRepo = createPostRepository({ dbPath });

  const created = siteRepo.createTopic({
    title: '模型评测',
    slug: 'model-eval',
    meta: 'Eval / Dataset',
    text: '把评测集和误报控制放到一条主线。',
    level: 5,
  });
  assert.equal(created.slug, 'model-eval');
  assert.ok(siteRepo.getSiteConfig().topics.cards.some((card) => card.slug === 'model-eval'));

  const post = postRepo.create({
    title: '模型评测笔记',
    body: '# 模型评测',
    published: true,
    topicSlugs: ['model-eval'],
  });
  assert.deepEqual(post.topicSlugs, ['model-eval']);

  const renamed = siteRepo.updateTopic('model-eval', {
    title: '模型评测与数据集',
    slug: 'model-evaluation',
    meta: 'Eval / Dataset / FP',
    text: '关注评测集、边界负样本和误报控制。',
    level: 7,
  });
  assert.equal(renamed.slug, 'model-evaluation');
  assert.deepEqual(postRepo.get(post.id).topicSlugs, ['model-evaluation']);
  assert.equal(postRepo.list({ topicSlug: 'model-eval' }).items.length, 0);
  assert.equal(postRepo.list({ topicSlug: 'model-evaluation' }).items.length, 1);

  assert.equal(siteRepo.deleteTopic('model-evaluation'), true);
  assert.equal(siteRepo.getSiteConfig().topics.cards.some((card) => card.slug === 'model-evaluation'), false);
  assert.deepEqual(postRepo.get(post.id).topicSlugs, []);
});

test('site config repository manages homepage section switches and ordering', () => {
  const repo = createSiteConfigRepository({ dbPath: tempDbPath() });

  const sections = repo.listSections();
  assert.ok(sections.some((section) => section.key === 'notes'));

  const updated = repo.updateSection('notes', {
    title: '笔记流',
    eyebrow: 'Writing',
    navLabel: '笔记',
    navSmall: 'log',
    enabled: false,
    sortOrder: 90,
  });

  assert.equal(updated.title, '笔记流');
  assert.equal(updated.enabled, 0);
  assert.equal(updated.sortOrder, 90);
  assert.equal(repo.enabledSections().some((section) => section.key === 'notes'), false);
});

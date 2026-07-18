import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPostRepository } from '../src/lib/server/postRepository.mjs';
import { markdownToHtml } from '../src/lib/server/markdownRenderer.mjs';

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-posts-')), 'blog.sqlite');
}

test('post repository creates, lists, updates, and deletes markdown posts', () => {
  const repo = createPostRepository({ dbPath: tempDbPath() });

  const created = repo.create({
    title: '近期笔记测试',
    category: 'AI Knowledge',
    description: '一条可管理的Markdown笔记',
    body: '## 小标题\n\n正文内容',
    featured: true,
    published: true,
    date: '2026-07-05',
    topicSlugs: ['llm-finetune', 'agent-system'],
  });

  assert.equal(created.slug, 'recent-note-test');
  assert.deepEqual(created.topicSlugs, ['agent-system', 'llm-finetune']);
  assert.equal(repo.getBySlug('recent-note-test').title, '近期笔记测试');
  assert.equal(repo.list().items[0].description, '一条可管理的Markdown笔记');
  assert.equal(repo.list({ topicSlug: 'agent-system' }).items[0].slug, 'recent-note-test');

  const updated = repo.update(created.id, {
    title: '近期笔记测试更新',
    slug: 'recent-note-test',
    category: 'Frontend',
    description: '更新后的摘要',
    body: '# 标题\n\n更新正文',
    featured: false,
    published: true,
    date: '2026-07-06',
    topicSlugs: ['frontend-interaction'],
  });

  assert.equal(updated.title, '近期笔记测试更新');
  assert.equal(updated.category, 'Frontend');
  assert.deepEqual(updated.topicSlugs, ['frontend-interaction']);
  assert.equal(repo.list({ topicSlug: 'agent-system' }).items.length, 0);
  assert.equal(repo.list({ topicSlug: 'frontend-interaction' }).items[0].slug, 'recent-note-test');
  assert.equal(repo.stats().published, 1);
  assert.equal(repo.remove(created.id), true);
  assert.equal(repo.stats().total, 0);
  assert.equal(repo.list({ topicSlug: 'frontend-interaction', filter: 'all' }).items.length, 0);
});

test('topic post order is independent and replacing links does not delete posts', () => {
  const repo = createPostRepository({ dbPath: tempDbPath() });
  const first = repo.create({
    title: '第一篇',
    date: '2026-07-01',
    topicSlugs: ['agent-system', 'rag-knowledge'],
  });
  const second = repo.create({
    title: '第二篇',
    date: '2026-07-02',
    topicSlugs: ['agent-system', 'rag-knowledge'],
  });
  const third = repo.create({
    title: '第三篇',
    date: '2026-07-03',
    topicSlugs: ['agent-system'],
  });

  const orderedIds = repo.setTopicPostOrder('agent-system', [third.id, 999999, third.id, first.id]);

  assert.deepEqual(orderedIds, [third.id, first.id]);
  assert.deepEqual(
    repo.list({ topicSlug: 'agent-system', filter: 'all' }).items.map((post) => post.id),
    [third.id, first.id],
  );
  assert.deepEqual(repo.get(second.id).topicSlugs, ['rag-knowledge']);
  assert.deepEqual(
    repo.list({ topicSlug: 'rag-knowledge', filter: 'all' }).items.map((post) => post.id),
    [second.id, first.id],
  );
  assert.equal(repo.stats().total, 3);
});

test('post repository imports markdown files without duplicating slugs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-md-'));
  fs.writeFileSync(path.join(root, 'hello-world.md'), `---
title: "Hello World"
description: "Imported summary"
date: 2026-07-04
category: "Deployment"
featured: true
---

## Start

Imported body.
`, 'utf8');

  const repo = createPostRepository({ dbPath: tempDbPath() });
  const first = repo.importFromDirectory(root);
  const second = repo.importFromDirectory(root);

  assert.equal(first.imported, 1);
  assert.equal(second.imported, 1);
  assert.equal(repo.stats().total, 1);
  assert.equal(repo.getBySlug('hello-world').featured, 1);
});

test('markdown renderer supports common writing syntax and extracts headings', () => {
  const rendered = markdownToHtml(`# 标题

## 二级标题

一段 **重点** 和 [链接](https://example.com)。

- 项目A
- 项目B

> 引用

\`\`\`js
console.log('ok')
\`\`\`
`);

  assert.match(rendered.html, /<h1 id="标题">标题<\/h1>/);
  assert.match(rendered.html, /<strong>重点<\/strong>/);
  assert.match(rendered.html, /<a href="https:\/\/example\.com" target="_blank" rel="noreferrer">链接<\/a>/);
  assert.match(rendered.html, /<ul>/);
  assert.match(rendered.html, /<blockquote>/);
  assert.match(rendered.html, /<pre><code class="language-js">/);
  assert.deepEqual(rendered.headings[0], { depth: 1, slug: '标题', text: '标题' });
});

test('markdown renderer supports gfm syntax used in admin preview', () => {
  const rendered = markdownToHtml(`使用文档：https://qwenlm.github.io/qwen-code-docs/zh/

之前在国内服务器上用过几次：

- 免费额度很少
- 质量属实一般

### 安装codex->配置代理->海外服务器

1. 登录服务器
2. 安装代理

- [x] 已完成
- [ ] 待验证

| 模块 | 结果 |
| --- | --- |
| Qwen Code | ~~暂不稳定~~ |
`);

  assert.match(rendered.html, /<a href="https:\/\/qwenlm\.github\.io\/qwen-code-docs\/zh\/" target="_blank" rel="noreferrer">/);
  assert.match(rendered.html, /<ul>/);
  assert.match(rendered.html, /<h3 id="安装codex-配置代理-海外服务器">安装codex->配置代理->海外服务器<\/h3>/);
  assert.match(rendered.html, /<ol>/);
  assert.match(rendered.html, /type="checkbox" checked disabled/);
  assert.match(rendered.html, /<table>/);
  assert.match(rendered.html, /<del>暂不稳定<\/del>/);
});

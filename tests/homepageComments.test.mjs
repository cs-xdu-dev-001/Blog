import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSiteConfigRepository } from '../src/lib/server/siteConfigRepository.mjs';

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dev-notes-comments-')), 'blog.sqlite');
}

test('site config stores Giscus settings without application secrets', () => {
  const repo = createSiteConfigRepository({ dbPath: tempDbPath() });

  const defaults = repo.getSiteConfig();
  assert.equal(defaults.comments.repo, 'cs-xdu-dev-001/Blog');
  assert.equal(defaults.comments.repoId, 'R_kgDOTTfuNQ');
  assert.equal(defaults.comments.category, 'Announcements');
  assert.equal(defaults.comments.categoryId, 'DIC_kwDOTTfuNc4DB4et');
  assert.equal('clientSecret' in defaults.comments, false);
  assert.equal(repo.getSection('comments').title, '留言');

  const updated = repo.updateSiteConfig({
    comments: {
      category: '留言',
      categoryId: 'DIC_kwDOTTfuNc4Ctest',
    },
  });

  assert.equal(updated.comments.repo, 'cs-xdu-dev-001/Blog');
  assert.equal(updated.comments.category, '留言');
  assert.equal(updated.comments.categoryId, 'DIC_kwDOTTfuNc4Ctest');
});

test('homepage only mounts the GitHub-authorized comment widget when configured', () => {
  const homepage = fs.readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
  const component = fs.readFileSync(new URL('../src/components/GiscusComments.astro', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

  assert.match(homepage, /siteConfig\.comments/);
  assert.match(homepage, /isSectionEnabled\('comments'\)/);
  assert.match(homepage, /<GiscusComments/);
  assert.match(homepage, /preconnectGiscus=/);
  assert.match(component, /https:\/\/giscus\.app\/client\.js/);
  assert.match(component, /\['data-mapping', 'pathname'\]/);
  assert.match(component, /\['data-lang', 'zh-CN'\]/);
  assert.match(component, /data-loading', 'eager'/);
  assert.match(component, /\['data-input-position', 'top'\]/);
  assert.match(component, /\['data-reactions-enabled', '1'\]/);
  assert.match(component, /requestIdleCallback/);
  assert.match(component, /rootMargin:\s*'1000px 0px'/);
  assert.match(component, /location\.hash === '#comments'/);
  assert.match(layout, /rel="preconnect" href="https:\/\/giscus\.app"/);
});

test('homepage admin exposes Giscus settings and saves them with the home payload', () => {
  const page = fs.readFileSync(new URL('../src/pages/admin/home.astro', import.meta.url), 'utf8');
  const script = fs.readFileSync(new URL('../public/admin-site.js', import.meta.url), 'utf8');

  assert.match(page, /name="comments\.repo"/);
  assert.match(page, /name="comments\.repoId"/);
  assert.match(page, /name="comments\.category"/);
  assert.match(page, /name="comments\.categoryId"/);
  assert.match(page, /https:\/\/github\.com\/apps\/giscus/);
  assert.match(page, /https:\/\/giscus\.app\/zh-CN/);
  assert.match(script, /comments:\s*\{/);
  assert.match(script, /repo:\s*values\.get\('comments\.repo'\)/);
  assert.match(script, /categoryId:\s*values\.get\('comments\.categoryId'\)/);
});

test('Giscus only accepts the blog domains and local development origins', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../giscus.json', import.meta.url), 'utf8'));

  assert.deepEqual(config.origins, [
    'https://blog.lajiyuming.tech',
    'https://lajiyuming.tech',
  ]);
  assert.ok(config.originsRegex.includes('^http://localhost:[0-9]+$'));
  assert.ok(config.originsRegex.includes('^http://127\\.0\\.0\\.1:[0-9]+$'));
  assert.equal(config.defaultCommentOrder, 'newest');
});

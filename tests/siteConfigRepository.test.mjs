import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSiteConfigRepository } from '../src/lib/server/siteConfigRepository.mjs';

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

  const updated = repo.updateSiteConfig({
    brandName: 'Dev Lab',
    heroLine: '新的首页文案',
    social: {
      github: 'https://github.com/example',
      bilibili: 'https://b23.tv/demo',
      qq: '123456',
    },
  });

  assert.equal(updated.brandName, 'Dev Lab');
  assert.equal(updated.heroLine, '新的首页文案');
  assert.equal(updated.social.qq, '123456');
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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  SITE_ORIGIN,
  absoluteSiteUrl,
  buildRssXml,
  buildSitemapXml,
} from '../src/lib/publicationMetadata.mjs';

test('public URLs always use the production blog origin', () => {
  assert.equal(SITE_ORIGIN, 'https://blog.lajiyuming.tech');
  assert.equal(absoluteSiteUrl('/posts/hello?preview=1#top'), 'https://blog.lajiyuming.tech/posts/hello?preview=1#top');
  assert.equal(absoluteSiteUrl('uploads/cover.webp'), 'https://blog.lajiyuming.tech/uploads/cover.webp');
  assert.equal(absoluteSiteUrl('https://cdn.example.com/cover.webp'), 'https://cdn.example.com/cover.webp');
});

test('RSS contains published note metadata and escapes XML', () => {
  const xml = buildRssXml({
    title: 'Dev Notes & Lab',
    description: '技术 < 生活',
    posts: [{
      slug: 'rss-note',
      title: 'RAG & Agent',
      description: '检索 < 生成',
      category: 'AI',
      date: '2026-07-16',
    }],
    now: new Date('2026-07-16T08:00:00.000Z'),
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<title>Dev Notes &amp; Lab<\/title>/);
  assert.match(xml, /<description>技术 &lt; 生活<\/description>/);
  assert.match(xml, /<atom:link href="https:\/\/blog\.lajiyuming\.tech\/rss\.xml" rel="self" type="application\/rss\+xml" \/>/);
  assert.match(xml, /<link>https:\/\/blog\.lajiyuming\.tech\/posts\/rss-note<\/link>/);
  assert.match(xml, /<guid isPermaLink="true">https:\/\/blog\.lajiyuming\.tech\/posts\/rss-note<\/guid>/);
  assert.match(xml, /<title>RAG &amp; Agent<\/title>/);
});

test('sitemap serializes public entries with optional update dates', () => {
  const xml = buildSitemapXml([
    { path: '/', priority: 1 },
    { path: '/posts/a&b', lastmod: '2026-07-16', priority: 0.8 },
  ]);

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/blog\.lajiyuming\.tech\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/blog\.lajiyuming\.tech\/posts\/a&amp;b<\/loc>/);
  assert.match(xml, /<lastmod>2026-07-16<\/lastmod>/);
  assert.match(xml, /<priority>0\.8<\/priority>/);
});

test('public layouts and XML routes expose complete publication metadata', () => {
  const config = fs.readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');
  const articleLayout = fs.readFileSync(new URL('../src/layouts/ArticleLayout.astro', import.meta.url), 'utf8');
  const rssRoute = fs.readFileSync(new URL('../src/pages/rss.xml.ts', import.meta.url), 'utf8');
  const sitemapRoute = fs.readFileSync(new URL('../src/pages/sitemap.xml.ts', import.meta.url), 'utf8');
  const robots = fs.readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');

  assert.match(config, /site:\s*['"]https:\/\/blog\.lajiyuming\.tech['"]/);
  assert.match(layout, /rel="canonical"/);
  assert.match(layout, /property="og:title"/);
  assert.match(layout, /property="og:image"/);
  assert.match(layout, /name="twitter:card"/);
  assert.match(layout, /rel="alternate"[^>]*application\/rss\+xml/);
  assert.match(layout, /noindex, nofollow/);
  assert.match(articleLayout, /type="article"/);
  assert.match(rssRoute, /application\/rss\+xml/);
  assert.match(rssRoute, /postRepository/);
  assert.match(sitemapRoute, /application\/xml/);
  assert.match(sitemapRoute, /postRepository/);
  assert.match(sitemapRoute, /readingRepository/);
  assert.match(sitemapRoute, /readingRepository\.list\(\{[^}]*publishedOnly:\s*true/);
  assert.match(sitemapRoute, /watchRepository/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: https:\/\/blog\.lajiyuming\.tech\/sitemap\.xml/);
});

import type { APIRoute } from 'astro';
import { buildSitemapXml } from '../lib/publicationMetadata.mjs';
import { postRepository } from '../lib/server/postRepository.mjs';
import { readingRepository } from '../lib/server/readingRepository.mjs';
import { siteConfigRepository } from '../lib/server/siteConfigRepository.mjs';
import { watchRepository } from '../lib/server/watchRepository.mjs';

export const prerender = false;

export const GET: APIRoute = () => {
  postRepository.ensureSeededFromContent();

  const posts = postRepository.list({ filter: 'published', limit: 500 }).items
    .filter((post) => !post.locked);
  const topics = siteConfigRepository.listTopics();
  const books = readingRepository.list({ filter: 'all', limit: 500, publishedOnly: true }).items;
  const watchItems = watchRepository.list({ filter: 'all', limit: 500 }).items;
  const entries = [
    { path: '/', changefreq: 'weekly', priority: 1 },
    { path: '/writing', changefreq: 'weekly', priority: 0.9 },
    { path: '/reading', changefreq: 'weekly', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.6 },
    ...posts.map((post) => ({
      path: `/posts/${encodeURIComponent(post.slug)}`,
      lastmod: post.updated_at || post.date,
      changefreq: 'monthly',
      priority: 0.8,
    })),
    ...topics.map((topic) => ({
      path: `/topics/${encodeURIComponent(topic.slug)}`,
      changefreq: 'weekly',
      priority: 0.7,
    })),
    ...books.map((book) => ({
      path: `/reading/${encodeURIComponent(book.slug)}`,
      lastmod: book.updated_at,
      changefreq: 'monthly',
      priority: 0.6,
    })),
    ...watchItems.map((item) => ({
      path: `/watch/${item.id}`,
      lastmod: item.updated_at,
      changefreq: 'monthly',
      priority: 0.6,
    })),
  ];

  return new Response(buildSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

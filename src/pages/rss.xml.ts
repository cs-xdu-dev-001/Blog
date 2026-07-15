import type { APIRoute } from 'astro';
import { buildRssXml } from '../lib/publicationMetadata.mjs';
import { postRepository } from '../lib/server/postRepository.mjs';
import { siteConfigRepository } from '../lib/server/siteConfigRepository.mjs';

export const prerender = false;

export const GET: APIRoute = () => {
  postRepository.ensureSeededFromContent();
  const siteConfig = siteConfigRepository.getSiteConfig();
  const posts = postRepository.list({ filter: 'published', limit: 500 }).items;
  const body = buildRssXml({
    title: siteConfig.brandName,
    description: siteConfig.pageDescription,
    posts: posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      category: post.category,
      date: post.date,
    })),
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=900',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};

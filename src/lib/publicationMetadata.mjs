export const SITE_ORIGIN = 'https://blog.lajiyuming.tech';
export const DEFAULT_OG_IMAGE_PATH = '/og-default.png';

export function absoluteSiteUrl(value = '/', origin = SITE_ORIGIN) {
  const text = String(value || '/').trim() || '/';
  return new URL(text.startsWith('/') || /^https?:\/\//i.test(text) ? text : `/${text}`, `${origin}/`).href;
}

export function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rssDate(value, fallback) {
  const date = value instanceof Date ? value : new Date(value || fallback);
  return Number.isNaN(date.valueOf()) ? fallback.toUTCString() : date.toUTCString();
}

export function buildRssXml({
  title = 'Dev Notes',
  description = '',
  posts = [],
  now = new Date(),
} = {}) {
  const items = posts.map((post) => {
    const url = absoluteSiteUrl(`/posts/${encodeURIComponent(post.slug)}`);
    return [
      '    <item>',
      `      <title>${escapeXml(post.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${escapeXml(rssDate(post.date, now))}</pubDate>`,
      `      <description>${escapeXml(post.description || '')}</description>`,
      post.category ? `      <category>${escapeXml(post.category)}</category>` : '',
      '    </item>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(absoluteSiteUrl('/'))}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>zh-CN</language>',
    `    <lastBuildDate>${escapeXml(now.toUTCString())}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(absoluteSiteUrl('/rss.xml'))}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].filter((line) => line !== '').join('\n');
}

function normalizeLastmod(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toISOString().slice(0, 10);
}

export function buildSitemapXml(entries = []) {
  const urls = entries.map((entry) => {
    const lastmod = normalizeLastmod(entry.lastmod);
    const priority = Number.isFinite(Number(entry.priority))
      ? Math.min(1, Math.max(0, Number(entry.priority))).toFixed(1)
      : '';
    return [
      '  <url>',
      `    <loc>${escapeXml(absoluteSiteUrl(entry.path))}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
      entry.changefreq ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : '',
      priority ? `    <priority>${priority}</priority>` : '',
      '  </url>',
    ].filter(Boolean).join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].filter((line) => line !== '').join('\n');
}

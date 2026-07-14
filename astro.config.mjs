import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'lajiyuming.tech' },
      { protocol: 'https', hostname: 'blog.lajiyuming.tech' },
    ],
  },
  devToolbar: {
    enabled: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});

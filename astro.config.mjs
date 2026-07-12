import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'blog.kards.asia' },
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

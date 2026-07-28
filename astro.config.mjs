import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  site: 'https://blog.lajiyuming.tech',
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
  vite: {
    resolve: {
      alias: [
        {
          find: '@codemirror/language-data',
          replacement: fileURLToPath(new URL('./src/scripts/codemirror-language-data.js', import.meta.url)),
        },
      ],
    },
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

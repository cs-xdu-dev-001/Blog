import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { fileURLToPath } from 'node:url';
import { SITE_ORIGIN } from './src/lib/publicationMetadata.mjs';

const siteHostname = new URL(SITE_ORIGIN).hostname;

export default defineConfig({
  site: SITE_ORIGIN,
  output: 'server',
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: siteHostname },
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
});

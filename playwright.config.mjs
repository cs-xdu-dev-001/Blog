import path from 'node:path';
import { defineConfig } from '@playwright/test';

const port = 55123;
const baseURL = `http://127.0.0.1:${port}`;
const tempRoot = path.resolve('.tmp', 'e2e');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    ...(process.platform === 'win32' ? { channel: 'chrome' } : {}),
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/start-e2e-server.mjs',
    url: `${baseURL}/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NODE_ENV: 'development',
      BLOG_DB_PATH: path.join(tempRoot, 'blog.sqlite'),
      BLOG_UPLOADS_ROOT: path.join(tempRoot, 'uploads'),
      ADMIN_USERNAME: 'e2e-admin',
      ADMIN_PASSWORD_HASH: 'scrypt:e2e-salt:a0ea482884446571e1b337b091f82c668d6fbcc589be3a17969fbe173a80252f807ba9d5d6db000e7711d948d2f9108f0bdc575aa60efc03be9e94abf548655d',
      ADMIN_SESSION_SECRET: 'e2e-admin-session-secret-that-is-not-used-in-production',
      LOCKED_NOTE_COOKIE_SECRET: 'e2e-locked-cookie-secret-that-is-not-used-in-production',
    },
  },
});

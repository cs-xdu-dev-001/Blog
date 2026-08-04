import { expect, test } from '@playwright/test';

test('首页与管理端只加载各自样式并返回请求ID', async ({ page }) => {
  const homepageStyles = [];
  page.on('response', (response) => {
    if (response.url().includes('/_astro/') && response.url().includes('.css')) {
      homepageStyles.push(response.url());
    }
  });

  const homepageResponse = await page.goto('/');
  expect(homepageResponse.headers()['x-request-id']).toBeTruthy();
  await expect(page.locator('.qzq-hero')).toBeVisible();
  expect(homepageStyles.some((url) => /\/global\.[^/]+\.css/.test(url))).toBeTruthy();
  expect(homepageStyles.some((url) => /\/home\.[^/]+\.css/.test(url))).toBeTruthy();
  expect(homepageStyles.some((url) => /\/admin\.[^/]+\.css/.test(url))).toBeFalsy();

  const adminStyles = [];
  page.on('response', (response) => {
    if (response.url().includes('/_astro/') && response.url().includes('.css')) {
      adminStyles.push(response.url());
    }
  });
  await page.goto('/admin/login');
  await expect(page.locator('.admin-login-card')).toBeVisible();
  expect(adminStyles.some((url) => /\/admin\.[^/]+\.css/.test(url))).toBeTruthy();
  expect(adminStyles.some((url) => /\/home\.[^/]+\.css/.test(url))).toBeFalsy();
  expect(adminStyles.some((url) => /\/global\.[^/]+\.css/.test(url))).toBeFalsy();
});

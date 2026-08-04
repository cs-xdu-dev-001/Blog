import { expect, test } from '@playwright/test';

const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function login(page) {
  await page.goto('/admin/login');
  await page.getByLabel('用户名').fill('e2e-admin');
  await page.getByLabel('密码').fill('e2e-password');
  await page.getByRole('button', { name: '进入控制台' }).click();
  await expect(page).toHaveURL(/\/admin\/watch$/);
}

async function uploadAndVerify(page, inputSelector, statusSelector) {
  const response = page.waitForResponse((item) => item.url().includes('/image') && item.request().method() === 'POST');
  await page.locator(inputSelector).setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: tinyPng });
  expect((await response).ok()).toBeTruthy();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator(statusSelector)).toContainText(/已就绪|已保存/);
  const coverStyle = await page.locator('.cms-cover-upload').getAttribute('style');
  expect(coverStyle).toContain('/uploads/');
  const imageUrl = coverStyle.match(/url\(['"]?([^'")]+)/)?.[1];
  expect(imageUrl).toBeTruthy();
  expect((await page.request.get(imageUrl)).ok()).toBeTruthy();
  return imageUrl;
}

function confirmNextDialog(page) {
  page.once('dialog', (dialog) => dialog.accept());
}

test.beforeEach(async ({ page }) => login(page));

test('阅读书架支持创建、编辑、上传、隐藏和删除', async ({ page }) => {
  const title = `E2E书籍 ${Date.now()}`;
  await page.goto('/admin/reading/new');
  await page.getByLabel('书名').fill(title);
  await page.getByLabel('作者').fill('测试作者');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/admin\/reading\/\d+\/edit$/);
  const imageUrl = await uploadAndVerify(page, '[data-reading-image]', '[data-reading-editor-state]');

  await page.getByLabel('简介').fill('浏览器流程验证');
  await page.getByLabel('发布').uncheck();
  await page.locator('[data-save-reading]').click();
  await expect(page.locator('[data-reading-editor-state]')).toHaveText('已保存');

  confirmNextDialog(page);
  await page.locator('[data-delete-reading]').click();
  await expect(page).toHaveURL(/\/admin\/reading$/);
  expect((await page.request.get(imageUrl)).status()).toBe(404);
});

test('影像档案支持创建、编辑、上传和删除', async ({ page }) => {
  const title = `E2E影像 ${Date.now()}`;
  await page.goto('/admin/watch/new');
  await page.getByLabel('名称').fill(title);
  await page.getByLabel('类型').selectOption({ label: '电影' });
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/admin\/watch\/\d+\/edit$/);
  const imageUrl = await uploadAndVerify(page, '[data-watch-image]', '[data-watch-editor-state]');

  await page.getByLabel('个人影评').fill('真实浏览器影像流程');
  await page.locator('[data-save-watch]').click();
  await expect(page.locator('[data-watch-editor-state]')).toHaveText('已保存');

  confirmNextDialog(page);
  await page.locator('[data-delete-watch]').click();
  await expect(page).toHaveURL(/\/admin\/watch$/);
  expect((await page.request.get(imageUrl)).status()).toBe(404);
});

test('美食支持创建、编辑、上传、隐藏和删除', async ({ page }) => {
  const title = `E2E美食 ${Date.now()}`;
  await page.goto('/admin/food/new');
  await page.getByLabel('店名').fill(title);
  await page.getByLabel('代表菜').fill('测试菜品');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/admin\/food\/\d+\/edit$/);
  const imageUrl = await uploadAndVerify(page, '[data-food-image]', '[data-food-editor-state]');

  await page.getByLabel('我的记录').fill('真实浏览器美食流程');
  await page.getByLabel('发布').uncheck();
  await page.locator('[data-save-food]').click();
  await expect(page.locator('[data-food-editor-state]')).toHaveText('已保存');

  confirmNextDialog(page);
  await page.locator('[data-delete-food]').click();
  await expect(page).toHaveURL(/\/admin\/food$/);
  expect((await page.request.get(imageUrl)).status()).toBe(404);
});

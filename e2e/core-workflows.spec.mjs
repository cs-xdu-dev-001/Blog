import { expect, test } from '@playwright/test';

const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('管理员可发布、上传图片并加密笔记，访客可解锁', async ({ page, context }) => {
  const editorModules = [];
  page.on('request', (request) => {
    if (request.url().includes('admin-post-milkdown') && request.url().includes('.js')) editorModules.push(request.url());
  });

  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel('用户名').fill('e2e-admin');
  await page.getByLabel('密码').fill('e2e-password');
  await page.getByRole('button', { name: '进入控制台' }).click();
  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/admin\/posts$/);

  await page.locator('[data-create-post][data-post-kind="technical"]').click();
  await expect(page).toHaveURL(/\/admin\/posts\/\d+\/edit$/);
  const fallback = page.locator('[data-editor-fallback]');
  await expect(fallback).toBeVisible();
  expect(editorModules).toHaveLength(0);

  const title = `E2E核心流程 ${Date.now()}`;
  await page.locator('input[name="title"]').fill(title);
  await page.locator('textarea[name="description"]').fill('Playwright隔离环境生成');
  await fallback.evaluate((element) => {
    element.value = '# 核心流程\n\n图片上传前的正文。';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const uploadResponse = page.waitForResponse((response) => (
    response.url().endsWith('/api/admin/posts/image') && response.request().method() === 'POST'
  ));
  await fallback.evaluate((element, png) => {
    const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'e2e.png', { type: 'image/png' });
    const data = new DataTransfer();
    data.items.add(file);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  }, tinyPng);
  expect((await uploadResponse).ok()).toBeTruthy();
  await expect(fallback).toHaveValue(/\/uploads\/posts\//);

  await page.locator('input[name="published"]').check();
  await page.locator('[data-save-post]').click();
  await expect(page.locator('[data-editor-status]')).toHaveText('已保存');
  const slug = await page.locator('input[name="slug"]').inputValue();

  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.locator('article img, main img').first()).toBeVisible();

  await page.goto('/admin/posts');
  await page.getByText(title, { exact: true }).click();
  await page.locator('input[name="visibility"][value="locked"]').check();
  await page.locator('input[name="lockedNoteKey"]').fill('e2e-note-key');
  await page.locator('[data-save-post]').click();
  await expect(page.locator('[data-editor-status]')).toHaveText('已保存');

  await context.clearCookies();
  await page.goto(`/posts/${slug}`);
  await expect(page.locator('[data-locked-post-unlock]')).toBeVisible();
  await page.getByLabel('访问密钥').fill('e2e-note-key');
  await page.getByRole('button', { name: '解锁' }).click();
  await expect(page).toHaveURL(new RegExp(`/posts/${slug}$`));
  await expect(page.getByText('图片上传前的正文。')).toBeVisible();
});

test('编辑器重型资源只在用户开始编辑后加载', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('用户名').fill('e2e-admin');
  await page.getByLabel('密码').fill('e2e-password');
  await page.getByRole('button', { name: '进入控制台' }).click();
  await page.goto('/admin/posts');
  await page.locator('[data-create-post][data-post-kind="technical"]').click();

  const loaded = [];
  page.on('request', (request) => {
    if (request.url().includes('admin-post-milkdown') && request.url().includes('.js')) loaded.push(request.url());
  });
  await expect(page.locator('[data-editor-fallback]')).toBeVisible();
  await page.waitForTimeout(800);
  expect(loaded).toHaveLength(0);

  await page.locator('[data-editor-fallback]').focus();
  await expect(page.locator('[data-milkdown-editor]')).toHaveAttribute('data-editor-state', 'ready', { timeout: 20_000 });
  expect(loaded.length).toBeGreaterThan(0);
});

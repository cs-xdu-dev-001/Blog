import { expect, test } from '@playwright/test';

async function openFreshEditor(page) {
  await page.goto('/admin/login');
  await page.getByLabel('用户名').fill('e2e-admin');
  await page.getByLabel('密码').fill('e2e-password');
  await page.getByRole('button', { name: '进入控制台' }).click();
  await page.evaluate(() => {
    window.localStorage.removeItem('dev-notes-post-editor-meta-collapsed');
  });
  await page.goto('/admin/posts');
  await page.locator('[data-create-post][data-post-kind="technical"]').click();
  await expect(page).toHaveURL(/\/admin\/posts\/\d+\/edit$/);
}

test('编辑器属性可折叠且图标、模式和Agent布局保持稳定', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshEditor(page);

  const shell = page.locator('[data-editor-shell]');
  const meta = page.locator('[data-post-form]');
  const metaToggle = page.locator('[data-editor-meta-toggle]');
  await expect(meta).toBeVisible();
  await expect(metaToggle).toHaveAttribute('aria-expanded', 'true');

  const topbar = page.locator('.post-editor-topbar');
  await expect(topbar).toHaveCSS('height', '44px');
  await expect(page.locator('[data-preview-link]')).toHaveAttribute('aria-label', '前台预览');
  await expect(page.locator('[data-delete-post]')).toHaveAttribute('aria-label', '删除笔记');
  await expect(page.locator('[data-save-post]')).toHaveAttribute('aria-label', '保存笔记');

  const expandedLayout = await page.evaluate(() => {
    const meta = document.querySelector('.post-editor-meta-grid').getBoundingClientRect();
    const modebar = document.querySelector('.post-editor-modebar').getBoundingClientRect();
    return {
      metaHeight: Math.round(meta.height),
      gap: Math.round(modebar.top - meta.bottom),
    };
  });
  expect(expandedLayout.metaHeight).toBeLessThan(310);
  expect(expandedLayout.gap).toBeLessThanOrEqual(12);

  await metaToggle.click();
  await expect(shell).toHaveClass(/is-meta-collapsed/);
  await expect(meta).toBeHidden();
  await expect(metaToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(metaToggle).toHaveAttribute('aria-label', '显示笔记属性');

  const compactLayout = await page.evaluate(() => {
    const shell = document.querySelector('[data-editor-shell]').getBoundingClientRect();
    const modebar = document.querySelector('.post-editor-modebar').getBoundingClientRect();
    const main = document.querySelector('.post-editor-main').getBoundingClientRect();
    return {
      controlsWidth: Math.round(modebar.width),
      topInset: Math.round(modebar.top - shell.top),
      contentGap: Math.round(main.top - modebar.bottom),
    };
  });
  expect(compactLayout.controlsWidth).toBeLessThan(280);
  expect(compactLayout.topInset).toBeLessThanOrEqual(8);
  expect(compactLayout.contentGap).toBeLessThanOrEqual(10);

  await page.reload();
  await expect(meta).toBeHidden();
  await expect(metaToggle).toHaveAttribute('aria-expanded', 'false');
  await metaToggle.click();
  await expect(meta).toBeVisible();

  const modeColors = await page.locator('[data-editor-mode]').evaluateAll((buttons) => (
    buttons.map((button) => getComputedStyle(button).backgroundColor)
  ));
  expect(modeColors[0]).not.toBe(modeColors[1]);

  const themeButton = page.locator('.post-editor-theme-toggle');
  const iconOffset = await themeButton.evaluate((button) => {
    const icon = [...button.querySelectorAll('svg')]
      .find((element) => getComputedStyle(element).display !== 'none');
    const buttonRect = button.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    return {
      x: Math.abs((buttonRect.left + buttonRect.width / 2) - (iconRect.left + iconRect.width / 2)),
      y: Math.abs((buttonRect.top + buttonRect.height / 2) - (iconRect.top + iconRect.height / 2)),
    };
  });
  expect(iconOffset.x).toBeLessThan(1.5);
  expect(iconOffset.y).toBeLessThan(1.5);

  await page.locator('[data-admin-agent-toggle]').click();
  await expect(page.locator('[data-admin-agent-panel]')).toBeVisible();
  await expect(page.locator('[data-post-editor-page]')).toHaveClass(/is-agent-open/);
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desktopOverflow).toBeLessThanOrEqual(0);
  await page.locator('[data-admin-agent-close]').click();

  await page.setViewportSize({ width: 820, height: 800 });
  await page.locator('[data-editor-mode="split"]').click();
  await expect(shell).toHaveClass(/is-split/);
  const panePositions = await page.locator('.post-editor-pane:visible').evaluateAll((panes) => (
    panes.map((pane) => {
      const rect = pane.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y) };
    })
  ));
  expect(panePositions).toHaveLength(2);
  expect(panePositions[0].x).toBe(panePositions[1].x);
  expect(panePositions[1].y).toBeGreaterThan(panePositions[0].y);
  const narrowOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(narrowOverflow).toBeLessThanOrEqual(0);
});

test('编辑器快捷键和版本历史沿用现有操作入口', async ({ page }) => {
  await openFreshEditor(page);

  await expect(page.locator('[data-preview-link]')).toHaveAttribute('title', '前台预览（Ctrl+P）');
  await expect(page.locator('[data-editor-mode="split"]')).toHaveAttribute('title', '分屏（Ctrl+\\）');
  await expect(page.locator('[data-admin-agent-toggle]')).toHaveAttribute('title', 'Agent（Ctrl+Shift+P）');

  await page.locator('input[name="title"]').fill('版本历史测试');
  await page.locator('[data-markdown-input]').fill('第一版正文');
  await page.locator('[data-save-post]').click();
  await expect(page.locator('[data-editor-status]')).toHaveAttribute('data-state', 'saved');

  await page.locator('[data-post-history-toggle]').click();
  await expect(page.locator('[data-post-history-dialog]')).toBeVisible();
  await expect(page.locator('[data-post-history-list] button')).toHaveCount(1);
  await page.locator('[data-post-history-close]').click();

  await page.keyboard.press('Control+\\');
  await expect(page.locator('[data-editor-shell]')).toHaveClass(/is-split/);
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('[data-admin-agent-panel]')).toBeVisible();
  await page.locator('[data-admin-agent-close]').click();

  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Control+P');
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.close();
});

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

  await metaToggle.click();
  await expect(shell).toHaveClass(/is-meta-collapsed/);
  await expect(meta).toBeHidden();
  await expect(metaToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(metaToggle).toHaveAttribute('aria-label', '显示笔记属性');

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

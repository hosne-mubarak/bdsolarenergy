import { expect, test } from '@playwright/test';

test('loads the React entry with styling and demo disclosure', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/bdsolarenergy/);
  await expect(page.getByRole('heading', { name: 'Power a brighter tomorrow.' })).toBeVisible();
  const notice = page.locator('.demo-notice');
  await expect(notice).toBeVisible();
  await expect(page.locator('.hero')).toHaveCSS('border-radius', '16px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile shell has a keyboard-operable modal and no horizontal overflow at 360px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.getByRole('banner').getByText('bdsolarenergy')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Shop all' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(menu).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

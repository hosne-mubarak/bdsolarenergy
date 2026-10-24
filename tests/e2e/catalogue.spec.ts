import { expect, test } from '@playwright/test';

test('filters and sorting persist through reload and browser history', async ({ page }) => {
  await page.goto('/products?page=2');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  await expect(page.getByText('Page 2 of 4')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Sunward Demo' }).check();
  await expect(page.getByText('16 products')).toBeVisible();
  await expect(page).toHaveURL(/brand=brand-1/);
  await page.getByLabel('Sort products').selectOption('price-asc');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Sunward Demo' })).toBeChecked();
  await expect(page.getByLabel('Sort products')).toHaveValue('price-asc');
  await page.goBack();
  await expect(page.getByLabel('Sort products')).toHaveValue('featured');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('search finds a SKU and opens variant-aware product details', async ({ page }) => {
  await page.goto('/search?q=BD-PANELS-1');
  await expect(page.getByText('1 products', { exact: true })).toBeVisible();
  await page.getByRole('article').getByRole('heading').getByRole('link').click();
  await expect(
    page.getByRole('heading', { level: 1, name: '550W Mono solar panel' }),
  ).toBeVisible();
  await page.getByLabel('Product option').selectOption('product-panels-1-v2');
  await expect(page.getByText('SKU: BD-PANELS-1-2')).toBeVisible();
  await expect(page.getByText('৳20,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByLabel('Quantity', { exact: true })).toHaveValue('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

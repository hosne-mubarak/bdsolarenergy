import { expect, test } from '@playwright/test';

test('cart and wishlist survive reload with current prices and coupon validation', async ({
  page,
}) => {
  await page.goto('/product/panels-550-1');
  await page.getByRole('button', { name: 'Save 550W Mono solar panel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Remove 550W Mono solar panel from wishlist' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart (2 items)' })).toBeVisible();
  await page.getByRole('link', { name: 'Shopping cart (2 items)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Quantity for 550W Mono solar panel')).toHaveValue('2');
  await page.getByLabel('Coupon code').fill('SOLAR10');
  await page.getByRole('button', { name: 'Apply coupon' }).click();
  await expect(page.getByText('Coupon discount', { exact: true })).toBeVisible();
  await expect(page.getByText('৳33,300', { exact: true })).toBeVisible();
  const wishlistShortcut = page.getByRole('link', { name: 'Wishlist (1 items)' });
  if (await wishlistShortcut.isVisible()) {
    await wishlistShortcut.click();
  } else {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: 'Wishlist', exact: true })
      .click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Your wishlist' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove 550W Mono solar panel from wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

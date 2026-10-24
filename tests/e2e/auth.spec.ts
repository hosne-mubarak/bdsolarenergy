import { expect, test, type Page } from '@playwright/test';
async function signIn(page: Page, email = 'demo@example.com', password = 'SolarDemo123!') {
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('protected return path, guest merge and logout isolate another account', async ({ page }) => {
  await page.goto('/product/panels-550-1');
  await page.getByRole('button', { name: 'Save 550W Mono solar panel', exact: true }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart (2 items)' })).toBeVisible();
  await page.goto('/account/wishlist?source=guard');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await signIn(page);
  await expect(page).toHaveURL(/\/account\/wishlist\?source=guard/);
  await expect(page.getByRole('heading', { name: 'Your wishlist', exact: true })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByLabel('Quantity for 550W Mono solar panel')).toHaveValue('2');
  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Power a brighter tomorrow.' })).toBeVisible();
  await page.goto('/login?returnTo=%2Fcart');
  await signIn(page, 'another@example.com');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test('registration and recovery use local verifiers without pretending to send email', async ({
  page,
}) => {
  await page.goto('/register?returnTo=%2Faccount%2Fwishlist');
  await page.getByLabel('Full name').fill('Demo Browser Customer');
  await page.getByLabel('Email address').fill('browser-customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('LocalPassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('LocalPassword123!');
  await page.getByRole('checkbox', { name: /agree.*terms/i }).check();
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/wishlist$/);
  await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('browser-customer@example.com');
  await page.getByRole('button', { name: 'Simulate reset request' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'No email was sent' })).toBeVisible();
  await page.getByRole('link', { name: 'Open demo reset' }).click();
  await page.getByLabel('New password', { exact: true }).fill('ResetPassword123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('ResetPassword123!');
  await page.getByRole('button', { name: 'Update demo password' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Demo password updated' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await signIn(page, 'browser-customer@example.com', 'ResetPassword123!');
  await expect(page).toHaveURL(/\/account$/);
});

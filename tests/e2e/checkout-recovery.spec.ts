import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, email = 'demo@example.com') {
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('SolarDemo123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function review(page: Page) {
  await page.goto('/product/panels-550-1');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart (1 items)' })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
  for (const [label, value] of [
    ['Recipient name', 'Recovery Demo Customer'],
    ['Phone number', '01812345678'],
    ['Division', 'Dhaka'],
    ['District', 'Dhaka'],
    ['Area', 'Dhanmondi'],
    ['Postal code', '1209'],
    ['Street address', 'House 12, Recovery Road'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page
    .getByRole('checkbox', {
      name: 'I understand this is a demo order and no payment will be collected',
    })
    .check();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
}
async function checkoutState(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('bdsolarenergy:checkout')!).data);
}

test('failed order write keeps the cart and retained retry places one order, then ownership protects its confirmation', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await review(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.assign(window, {
      restoreDemoWrites: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bdsolarenergy:checkout')
        throw new DOMException('Demo quota fault', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /storage is unavailable/i }),
  ).toBeVisible();
  const failed = await checkoutState(page);
  expect(failed.orders).toHaveLength(0);
  expect(failed.carts['user-demo'].lines).toHaveLength(1);
  const attemptsBefore = await page.evaluate(
    () => JSON.parse(localStorage.getItem('bdsolarenergy:checkout-attempts')!).data['user-demo'],
  );
  expect(Object.keys(attemptsBefore)).toHaveLength(1);
  await page.evaluate(() =>
    (window as unknown as { restoreDemoWrites(): void }).restoreDemoWrites(),
  );
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  const confirmation = new URL(page.url()).pathname;
  const placed = await checkoutState(page);
  expect(placed.orders).toHaveLength(1);
  expect(placed.orders[0].idempotencyKey).toBe(Object.values(attemptsBefore)[0]);
  expect(placed.carts['user-demo'].lines).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/login?returnTo=${encodeURIComponent(confirmation)}`);
  await signIn(page, 'another@example.com');
  await expect(page.getByRole('heading', { name: 'Order not found' })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Recovery Demo Customer');
  await page.goto('/account/orders');
  await expect(page.getByRole('heading', { name: 'No demo orders yet' })).toBeVisible();
});

test('a changed cart requires a fresh review before an order can be placed', async ({ page }) => {
  await review(page);
  await page.evaluate(() => {
    const key = 'bdsolarenergy:checkout';
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.data.carts['user-demo'].lines[0].quantity = 2;
    envelope.data.revision++;
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /changed|review/i })).toBeVisible();
  expect((await checkoutState(page)).orders).toHaveLength(0);
  expect((await checkoutState(page)).carts['user-demo'].lines[0].quantity).toBe(2);
  await page.getByRole('button', { name: 'Edit checkout' }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText(/Quantity 2/)).toBeVisible();
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  expect((await checkoutState(page)).orders[0].items[0].quantity).toBe(2);
});

test('stock reserved after review never produces an oversold order', async ({ page }) => {
  await review(page);
  await page.evaluate(() => {
    const key = 'bdsolarenergy:checkout';
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.data.reservations['product-panels-1-v1'] = 12;
    envelope.data.revision++;
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: /stock|cart|quantity|review/i }),
  ).toBeVisible();
  expect((await checkoutState(page)).orders).toHaveLength(0);
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toHaveCount(0);
});

test('empty results and unknown routes expose working catalogue recovery', async ({ page }) => {
  await page.goto('/search?q=unmatched-demonstration-token');
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
  await page.goto('/product/no-such-demo-product');
  await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Return home', exact: true })).toBeVisible();
  await page.goto('/no-such-demo-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Browse products' }).click();
  await expect(page.getByRole('heading', { name: 'All products' })).toBeVisible();
});

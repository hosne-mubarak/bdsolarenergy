import { expect, test, type Page } from '@playwright/test';

const acknowledgement = 'I understand this is a demo order and no payment will be collected';
async function signIn(page: Page) {
  await page.getByLabel('Email address').fill('demo@example.com');
  await page.getByLabel('Password', { exact: true }).fill('SolarDemo123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function fillAddress(page: Page, district: string, recipient: string) {
  await page.getByLabel('Recipient name').fill(recipient);
  await page.getByLabel('Phone number').fill('01812345678');
  await page.getByLabel('Division', { exact: true }).fill(district);
  await page.getByLabel('District', { exact: true }).fill(district);
  await page.getByLabel('Area', { exact: true }).fill('Demonstration area');
  await page.getByLabel('Postal code').fill(district === 'Dhaka' ? '1209' : '4000');
  await page.getByLabel('Street address').fill('House 10, Road 5, Demo delivery destination');
}
async function addSelectedVariant(page: Page) {
  await page.getByLabel('Product option').selectOption('product-panels-1-v2');
  await expect(page.getByText('SKU: BD-PANELS-1-2')).toBeVisible();
  await expect(page.getByText('৳20,000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('link', { name: 'Shopping cart (1 items)' }).click();
  await expect(page.getByLabel('Quantity for 550W Mono solar panel', { exact: true })).toHaveValue(
    '1',
  );
  await expect(page.getByRole('main')).toContainText('BD-PANELS-1-2');
}

test('search and filters lead to one persisted variant purchase after an invalid coupon and double activation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search products' }).fill('BD-PANELS-1');
  await page.getByRole('button', { name: 'Submit search' }).click();
  await expect(page).toHaveURL(/\/search\?q=BD-PANELS-1$/);
  await page.getByLabel('Availability').selectOption('in_stock');
  await expect(page).toHaveURL(/stock=in_stock/);
  const brand = page.getByRole('checkbox', { name: 'Sunward Demo' });
  await brand.click();
  await expect(brand).toBeChecked();
  await expect(page).toHaveURL(/brand=brand-1/);
  await page.getByLabel('Sort products').selectOption('price-asc');
  await expect(page.getByText('1 products', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/stock=in_stock/);
  await page.getByRole('article').getByRole('heading').getByRole('link').click();
  await expect(
    page.getByRole('heading', { name: '550W Mono solar panel', exact: true }),
  ).toBeVisible();
  await addSelectedVariant(page);
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/checkout');
  await signIn(page);
  await expect(page).toHaveURL(/\/checkout$/);
  await fillAddress(page, 'Dhaka', 'Demo Mobile Payment Customer');
  await page.getByRole('button', { name: 'Use this address' }).click();
  await page.getByLabel('Delivery method').selectOption('shipping-dhaka');
  await page.getByLabel('Payment method').selectOption('payment-mobile');
  await expect(page.getByLabel(/^(mobile account number|pin|otp|card number|cvv)$/i)).toHaveCount(
    0,
  );
  await page.getByLabel('Coupon code').fill('INVALID-CHECKOUT-CODE');
  await page.getByRole('checkbox', { name: acknowledgement }).check();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('alert')).toContainText(/coupon.*invalid/i);
  await expect(page.getByRole('heading', { name: 'Review your order' })).toHaveCount(0);
  await expect(page.getByLabel('Recipient name')).toHaveValue('Demo Mobile Payment Customer');
  await page.getByLabel('Coupon code').fill('SOLAR10');
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText('৳18,080', { exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('BD-PANELS-1-2');
  await page.getByRole('button', { name: 'Place demo order' }).click({ clickCount: 2 });
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  const confirmation = new URL(page.url()).pathname;
  expect(confirmation).toMatch(/^\/order-confirmation\/[^/]+$/);
  const reference = confirmation.split('/').at(-1)!;
  await expect(page.getByRole('main')).toContainText(
    'No real payment was collected. No delivery will occur.',
  );
  await expect(page.getByRole('main')).toContainText('payment-mobile');
  await expect(page.getByRole('link', { name: 'Shopping cart (0 items)' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(reference);
  await expect(page.getByText('৳18,080', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View order history' }).click();
  await expect(page.getByRole('heading', { name: 'Order history', exact: true })).toBeVisible();
  const detail = page.getByRole('link', { name: /^View order details/ });
  await expect(detail).toHaveCount(1);
  await expect(detail).toHaveAttribute('href', `/account/orders/${reference}`);
  await detail.click();
  await expect(page.getByRole('main')).toContainText('Demo Mobile Payment Customer');
  await page.getByRole('link', { name: 'Track demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Demo order tracking' })).toBeVisible();
  await expect(page.locator('.tracking-timeline > li')).toHaveCount(1);
  await expect(page.getByRole('main')).toContainText('No live shipment or courier booking exists.');
  await page.reload();
  await expect(page.locator('.tracking-timeline > li')).toHaveCount(1);
});

test('an owned saved address supports a national-delivery card simulation without payment credentials', async ({
  page,
}) => {
  await page.goto('/login?returnTo=%2Faccount%2Faddresses%2Fnew');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Add address', exact: true })).toBeVisible();
  await fillAddress(page, 'Chattogram', 'Demo Card Payment Customer');
  await page.getByRole('checkbox', { name: 'Make this my default address' }).check();
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('heading', { name: 'Address book' })).toBeVisible();
  await expect(page.getByText('Default address', { exact: true })).toBeVisible();
  await page.goto('/product/panels-550-1');
  await addSelectedVariant(page);
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  const saved = page.getByRole('option', { name: /Demo Card Payment Customer.*default/ });
  await expect(saved).toHaveCount(1);
  const addressId = await saved.getAttribute('value');
  expect(addressId).toBeTruthy();
  await page.getByLabel('Saved address').selectOption(addressId!);
  await expect(page.getByLabel('Recipient name')).toHaveCount(0);
  await page.getByLabel('Delivery method').selectOption('shipping-national');
  await page.getByLabel('Payment method').selectOption('payment-card');
  await expect(
    page.getByLabel(/^(card number|cvv|security code|account number|pin|otp)$/i),
  ).toHaveCount(0);
  await page.getByRole('checkbox', { name: acknowledgement }).check();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText('৳20,150', { exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Outside Dhaka delivery');
  await page.getByRole('button', { name: 'Place demo order' }).click();
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Chattogram');
  await expect(page.getByRole('main')).toContainText('payment-card');
  await expect(page.getByText('৳20,150', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('main')).toContainText('Demo Card Payment Customer');
  await expect(page.getByRole('main')).toContainText('Chattogram');
});

import { mkdir, writeFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { format } from 'prettier';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const auditResults: {
  label: string;
  engine: string;
  serious: number;
  critical: number;
  other: { id: string; impact: string | null | undefined }[];
  incomplete: string[];
  passedRules: number;
}[] = [];

async function tabTo(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  for (let index = 0; index < 120; index++) {
    if (await control.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(control, 'Control must be reachable by Tab alone').toBeFocused();
}
async function activate(page: Page, control: Locator) {
  await tabTo(page, control);
  await page.keyboard.press('Enter');
}
async function typeWithKeyboard(page: Page, control: Locator, value: string) {
  await tabTo(page, control);
  await page.keyboard.type(value);
}
async function audit(page: Page, info: TestInfo, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  await info.attach(`axe-${label}`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  auditResults.push({
    label,
    engine: results.testEngine.version,
    serious: results.violations.filter(({ impact }) => impact === 'serious').length,
    critical: results.violations.filter(({ impact }) => impact === 'critical').length,
    other: results.violations
      .filter(({ impact }) => impact !== 'serious' && impact !== 'critical')
      .map(({ id, impact }) => ({ id, impact })),
    incomplete: results.incomplete.map(({ id }) => id),
    passedRules: results.passes.length,
  });
  const severe = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
  expect.soft(severe, `Serious/critical axe violations at ${label}`).toEqual([]);
}
async function checkOverflow(page: Page, label: string) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    windowWidth: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect
    .soft(dimensions.document, `${label}: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewport + 1);
}
async function purchase(page: Page, info?: TestInfo, captureCheckout = false) {
  await page.goto('/product/panels-550-1');
  await expect(
    page.getByRole('heading', { level: 1, name: '550W Mono solar panel' }),
  ).toBeVisible();
  if (info) await audit(page, info, 'product');
  await activate(page, page.getByRole('button', { name: 'Add to cart', exact: true }));
  const cart = page.getByRole('link', { name: 'Shopping cart (1 items)' });
  await expect(cart).toBeVisible();
  await activate(page, cart);
  await expect(page.getByRole('heading', { name: 'Shopping cart', exact: true })).toBeVisible();
  if (info) await audit(page, info, 'cart');
  await activate(page, page.getByRole('link', { name: 'Proceed to checkout' }));
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  if (info) await audit(page, info, 'login');
  await typeWithKeyboard(page, page.getByLabel('Email address'), 'demo@example.com');
  await typeWithKeyboard(page, page.getByLabel('Password', { exact: true }), 'SolarDemo123!');
  await activate(page, page.getByRole('button', { name: 'Sign in', exact: true }));
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
  if (info) await audit(page, info, 'checkout-address');
  for (const [label, value] of [
    ['Recipient name', 'Keyboard Demo Customer with a deliberately long recipient name for reflow'],
    ['Phone number', '01812345678'],
    ['Division', 'Dhaka'],
    ['District', 'Dhaka'],
    ['Area', 'Dhanmondi'],
    ['Postal code', '1209'],
    ['Street address', 'House 10, Road 5, Demonstration delivery address'],
  ]) {
    await typeWithKeyboard(page, page.getByLabel(label, { exact: true }), value);
  }
  await activate(page, page.getByRole('button', { name: 'Use this address' }));
  await expect(page.getByRole('status').filter({ hasText: 'Using address:' })).toBeVisible();
  await tabTo(page, page.getByLabel('Delivery method'));
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await tabTo(page, page.getByLabel('Payment method'));
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await typeWithKeyboard(page, page.getByLabel('Coupon code'), 'SOLAR10');
  const acknowledgement = page.getByRole('checkbox', {
    name: 'I understand this is a demo order and no payment will be collected',
  });
  await tabTo(page, acknowledgement);
  await page.keyboard.press('Space');
  await expect(acknowledgement).toBeChecked();
  if (captureCheckout)
    await page.screenshot({ path: 'docs/testing/screenshots/checkout-360.png', fullPage: true });
  await activate(page, page.getByRole('button', { name: 'Review order' }));
  await expect(page.getByRole('heading', { name: 'Review your order' })).toBeVisible();
  await expect(page.getByText('৳16,730', { exact: true })).toBeVisible();
  if (info) await audit(page, info, 'checkout-review');
  await activate(page, page.getByRole('button', { name: 'Place demo order' }));
  await expect(page.getByRole('heading', { name: 'Demo order confirmed' })).toBeVisible();
  await expect(page).toHaveURL(/\/order-confirmation\/[^/]+$/);
  if (info) await audit(page, info, 'confirmation');
  const confirmationPath = new URL(page.url()).pathname;
  const id = confirmationPath.split('/').at(-1)!;
  return { id, confirmationPath };
}
async function ready(page: Page) {
  await expect(page.locator('main h1, main h2').first()).toBeVisible();
}

test('keyboard purchase and representative screens have no serious or critical axe violations', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  auditResults.length = 0;
  const order = await purchase(page, info);
  await activate(page, page.getByRole('link', { name: 'View order history' }));
  await expect(page.getByRole('heading', { name: 'Order history', exact: true })).toBeVisible();
  await audit(page, info, 'order-history');
  for (const [label, route] of [
    ['home', '/'],
    ['catalogue', '/products'],
    ['account', '/account'],
    ['address-form', '/account/addresses/new'],
    ['order-details', `/account/orders/${order.id}`],
    ['order-tracking', `/account/orders/${order.id}/tracking`],
    ['contact', '/contact'],
    ['faq', '/faq'],
  ]) {
    await page.goto(route);
    await ready(page);
    await audit(page, info, label);
  }
  await mkdir('docs/testing', { recursive: true });
  await writeFile(
    `docs/testing/axe-${info.project.name}.json`,
    await format(JSON.stringify(auditResults), {
      parser: 'json',
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'all',
    }),
  );
});

test('responsive layouts, 200 percent reflow, native disclosures and dialog focus are usable', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await mkdir('docs/testing/screenshots', { recursive: true });
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    await checkOverflow(page, `${width}px /login`);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  const order = await purchase(page, undefined, info.project.name === 'chromium');
  await page.goto('/product/panels-550-1');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Shopping cart (1 items)' })).toBeVisible();
  // Stress an isolated stored snapshot after the real purchase; normal repository reads render it.
  await page.evaluate((orderId) => {
    const key = 'bdsolarenergy:checkout';
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error('Expected the completed demo order aggregate.');
    const envelope = JSON.parse(raw);
    const saved = envelope.data.orders.find((item: { id: string }) => item.id === orderId);
    if (!saved) throw new Error('Expected the completed demo order snapshot.');
    saved.items[0].unitPrice = Number.MAX_SAFE_INTEGER;
    saved.items[0].lineTotal = Number.MAX_SAFE_INTEGER;
    saved.totals = {
      subtotal: Number.MAX_SAFE_INTEGER,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: Number.MAX_SAFE_INTEGER,
    };
    saved.couponCode = null;
    window.localStorage.setItem(key, JSON.stringify(envelope));
  }, order.id);
  const routes = [
    '/',
    '/products',
    '/product/panels-550-1',
    '/cart',
    '/account',
    '/account/addresses/new',
    '/checkout',
    order.confirmationPath,
    '/account/orders',
    `/account/orders/${order.id}`,
    '/contact',
    '/faq',
  ];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      await ready(page);
      if (route === order.confirmationPath)
        await expect(page.getByRole('main')).toContainText('৳90,071,992,547,409.91');
      await checkOverflow(page, `${width}px ${route}`);
      if (info.project.name === 'chromium' && width === 360 && route === '/')
        await page.screenshot({ path: 'docs/testing/screenshots/home-360.png', fullPage: true });
      if (info.project.name === 'chromium' && width === 1440 && route === '/product/panels-550-1')
        await page.screenshot({
          path: 'docs/testing/screenshots/product-1440.png',
          fullPage: true,
        });
    }
  }
  // CSS zoom exercises layout reflow at 200%; this is distinct from browser UI zoom or pinch scaling.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of ['/products', `/account/orders/${order.id}`, '/contact']) {
    await page.goto(route);
    await ready(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    await checkOverflow(page, `200% CSS zoom ${route}`);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '';
    });
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/faq');
  await ready(page);
  const question = page.locator('main details').first();
  const summary = question.locator('summary');
  await tabTo(page, summary);
  await page.keyboard.press('Enter');
  await expect(question).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(question).not.toHaveAttribute('open', '');
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await activate(page, menu);
  const dialog = page.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(menu).toBeFocused();
});

test('product review ratings expose a valid accessible image label', async ({ page }, info) => {
  auditResults.length = 0;
  await page.goto('/product/panels-550-1');
  await expect(
    page.getByRole('heading', { level: 1, name: '550W Mono solar panel' }),
  ).toBeVisible();
  await expect(page.getByRole('img', { name: '5 out of 5 stars', exact: true })).toBeVisible();
  await audit(page, info, 'product-ratings-followup');
  await mkdir('docs/testing', { recursive: true });
  await writeFile(
    `docs/testing/axe-product-followup-${info.project.name}.json`,
    await format(JSON.stringify(auditResults), {
      parser: 'json',
      printWidth: 100,
      singleQuote: true,
      trailingComma: 'all',
    }),
  );
});

import { expect, test, type Locator, type Page } from '@playwright/test';

const account = {
  name: 'Browser Account Customer',
  email: 'account-journey@example.com',
  password: 'BrowserAccount123!',
};
async function dismissNotice(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  if (await dismiss.isVisible()) await dismiss.click();
}
async function signIn(page: Page, email = 'demo@example.com', password = 'SolarDemo123!') {
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function fillAddress(page: Page, recipient: string, street: string) {
  await page.getByLabel('Recipient name', { exact: true }).fill(recipient);
  await page.getByLabel('Phone number', { exact: true }).fill('01812345678');
  await page.getByLabel('Division', { exact: true }).fill('Dhaka');
  await page.getByLabel('District', { exact: true }).fill('Dhaka');
  await page.getByLabel('Area', { exact: true }).fill('Dhanmondi');
  await page.getByLabel('Postal code', { exact: true }).fill('1209');
  await page.getByLabel('Street address', { exact: true }).fill(street);
}
function addressCard(page: Page, recipient: string): Locator {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: recipient, exact: true }) });
}

test('registration, profile, address defaults and preferences persist and stay isolated after logout', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/register?returnTo=%2Faccount%2Fprofile%2Fedit');
  await page.getByLabel('Full name', { exact: true }).fill(account.name);
  await page.getByLabel('Email address', { exact: true }).fill(account.email);
  const password = page.getByLabel('Password', { exact: true });
  const confirmation = page.getByLabel('Confirm password', { exact: true });
  await password.fill(account.password);
  await confirmation.fill('DifferentPassword123!');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue(account.password);
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(confirmation).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('checkbox', { name: 'I agree to the terms' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await confirmation.fill(account.password);
  await page.getByRole('checkbox', { name: 'I agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page).toHaveURL(/\/account\/profile\/edit$/);
  await expect(page.getByRole('heading', { name: 'Edit profile', exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByLabel('Full name', { exact: true }).fill('Updated Browser Customer');
  await page.getByLabel('Phone number', { exact: true }).fill('01912345678');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Updated Browser Customer');
  await expect(page.getByRole('main')).toContainText('01912345678');
  await page.reload();
  await expect(page.getByRole('main')).toContainText('Updated Browser Customer');
  await dismissNotice(page);

  await page.goto('/account/addresses/new');
  await fillAddress(page, 'Home Contact', 'House 10, Road 5');
  await page.getByRole('checkbox', { name: 'Make this my default address' }).check();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Address book', exact: true })).toBeVisible();
  await expect(
    addressCard(page, 'Home Contact').getByText('Default address', { exact: true }),
  ).toBeVisible();
  await dismissNotice(page);
  await page.getByRole('link', { name: 'Add address', exact: true }).click();
  await fillAddress(page, 'Office Contact', 'House 20, Road 9');
  await page.getByRole('checkbox', { name: 'Make this my default address' }).check();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(
    addressCard(page, 'Office Contact').getByText('Default address', { exact: true }),
  ).toBeVisible();
  await expect(
    addressCard(page, 'Home Contact').getByText('Default address', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Default address', { exact: true })).toHaveCount(1);
  await dismissNotice(page);

  await addressCard(page, 'Home Contact')
    .getByRole('link', { name: 'Edit address', exact: true })
    .click();
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('House 10, Road 5');
  await page.getByLabel('Street address', { exact: true }).fill('House 11, Road 6');
  await page.getByRole('checkbox', { name: 'Make this my default address' }).check();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(addressCard(page, 'Home Contact')).toContainText('House 11, Road 6');
  await expect(
    addressCard(page, 'Home Contact').getByText('Default address', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Default address', { exact: true })).toHaveCount(1);
  await dismissNotice(page);
  await addressCard(page, 'Home Contact')
    .getByRole('button', { name: 'Delete address', exact: true })
    .click();
  let dialog = page.getByRole('dialog', { name: 'Delete this address?', exact: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(addressCard(page, 'Home Contact')).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await addressCard(page, 'Home Contact')
    .getByRole('button', { name: 'Delete address', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Delete this address?', exact: true });
  await dialog.getByRole('button', { name: 'Delete address', exact: true }).click();
  await expect(addressCard(page, 'Home Contact')).toHaveCount(0);
  await expect(
    addressCard(page, 'Office Contact').getByText('Default address', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(addressCard(page, 'Office Contact')).toContainText('House 20, Road 9');
  const officeEditPath = await addressCard(page, 'Office Contact')
    .getByRole('link', { name: 'Edit address', exact: true })
    .getAttribute('href');
  expect(officeEditPath).toMatch(/^\/account\/addresses\/[^/]+\/edit$/);

  await page.goto('/account/settings');
  await page.getByRole('checkbox', { name: 'Order update preference', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compact product cards', exact: true }).check();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preferences saved' })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'Order update preference', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Compact product cards', exact: true }),
  ).toBeChecked();
  await expect(page.getByRole('main')).toHaveClass(/compact-products/);

  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login?returnTo=%2Faccount%2Fsettings');
  await signIn(page, 'another@example.com');
  await expect(page).toHaveURL(/\/account\/settings$/);
  await expect(
    page.getByRole('checkbox', { name: 'Order update preference', exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Compact product cards', exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole('main')).not.toHaveClass(/compact-products/);
  await page.goto('/account/addresses');
  await expect(
    page.getByRole('heading', { name: 'No saved addresses', exact: true }),
  ).toBeVisible();
  await page.goto(officeEditPath!);
  await expect(page.getByRole('alert')).toContainText(/could not be found|not found/i);
  await expect(page.getByLabel('Recipient name', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText('House 20, Road 9');
  await page.goto('/account/profile');
  await expect(page.getByRole('main')).toContainText('Another Customer');
  await expect(page.getByRole('main')).not.toContainText('Updated Browser Customer');
});

test('normalized duplicate registration reports the field error and clears attempted passwords', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Full name', { exact: true }).fill('Duplicate Demo Customer');
  await page.getByLabel('Email address', { exact: true }).fill(' DEMO@EXAMPLE.COM ');
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password', { exact: true }).fill(account.password);
  await page.getByRole('checkbox', { name: 'I agree to the terms' }).check();
  await page.getByRole('button', { name: 'Create demo account', exact: true }).click();
  await expect(page.getByLabel('Email address', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: /already exists|already registered/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/register$/);
  expect(
    await page.evaluate(() => ({
      local: localStorage.getItem('bdsolarenergy:session'),
      tab: sessionStorage.getItem('bdsolarenergy:session'),
    })),
  ).toEqual({ local: null, tab: null });
});

test('an expired remembered session restores the safe destination after signing in without losing account intent', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/login?returnTo=%2Faccount%2Faddresses%2Fnew');
  await page.getByRole('checkbox', { name: 'Remember me', exact: true }).check();
  await signIn(page);
  await expect(page).toHaveURL(/\/account\/addresses\/new$/);
  await fillAddress(page, 'Expiry Demo Contact', 'House 30, Road 8');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(addressCard(page, 'Expiry Demo Contact')).toBeVisible();
  await page.goto('/product/panels-550-1');
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Shopping cart (1 items)', exact: true }),
  ).toBeVisible();
  // Deliberate isolated failure fixture; no waiting for real time or production expiry controls.
  await page.evaluate(() => {
    const key = 'bdsolarenergy:session';
    const envelope = JSON.parse(localStorage.getItem(key)!);
    envelope.data.expiresAt = '2020-01-01T00:00:00Z';
    localStorage.setItem(key, JSON.stringify(envelope));
  });
  await page.goto('/account/addresses?source=expired-session');
  await expect(
    page.getByRole('heading', { name: 'Sign in to your account', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
    '/account/addresses?source=expired-session',
  );
  await expect(page.getByRole('main')).not.toContainText('Expiry Demo Contact');
  await expect(
    page.getByRole('link', { name: 'Shopping cart (0 items)', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bdsolarenergy:session'))).toBeNull();
  await signIn(page);
  await expect(page).toHaveURL(/\/account\/addresses\?source=expired-session$/);
  await expect(addressCard(page, 'Expiry Demo Contact')).toContainText('House 30, Road 8');
  await expect(
    page.getByRole('link', { name: 'Shopping cart (1 items)', exact: true }),
  ).toBeVisible();
});

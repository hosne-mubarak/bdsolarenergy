import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './redirect';

describe('safe post-login return paths', () => {
  it.each(['/cart', '/account/orders?page=2', '/products?sort=price-asc', '/cart#summary'])(
    'preserves an internal application path: %s',
    (path) => expect(safeReturnPath(path)).toBe(path),
  );

  it.each([
    null,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%2f%2fevil.test',
    '/%5cevil.test',
    '/cart\n',
    '/cart\u0000',
    '/login',
    '/register?returnTo=%2Flogin',
    '/logout',
    ' /cart',
  ])('rejects unsafe return path %s', (path) => {
    expect(safeReturnPath(path)).toBe('/account');
  });

  it('uses the requested safe fallback when a return path is rejected', () => {
    expect(safeReturnPath('https://evil.test', '/products')).toBe('/products');
  });
});

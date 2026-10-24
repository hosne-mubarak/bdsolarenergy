import { describe, expect, it } from 'vitest';
import type { Coupon, Product, ShippingMethod } from '../../types';
import { calculateCart, validateQuantity } from '../cart/rules';
import { calculateTotals, couponDiscount, findCoupon } from './rules';

const now = new Date('2026-10-24T00:00:00Z');
function product(id: string, price = 10000, categoryId = 'panels'): Product {
  return {
    id,
    slug: id,
    categoryId,
    brandId: 'brand-1',
    name: `Sample ${id}`,
    summary: 'Sample',
    description: 'Sample description',
    imageIds: ['image-1'],
    specifications: [],
    variants: [
      {
        id: `${id}-sku`,
        productId: id,
        sku: `${id}-SKU`,
        attributes: {},
        price,
        compareAtPrice: price * 2,
        stock: 10,
        maxPerOrder: 5,
        weightGrams: 1000,
      },
    ],
    tags: [],
    createdAt: now.toISOString(),
    popularity: 0,
  };
}
const products = [product('panel'), product('cable', 5000, 'cables')];
const shipping: ShippingMethod = {
  id: 'dhaka',
  label: 'Dhaka',
  districts: ['Dhaka'],
  fee: 1000,
  freeAbove: 20000,
  estimatedDays: { min: 1, max: 3 },
};
const coupon: Coupon = {
  id: 'solar10',
  code: 'SOLAR10',
  type: 'percentage',
  amount: 10,
  minimumSubtotal: 10000,
  maximumDiscount: null,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-12-31T23:59:59Z',
  eligibleCategoryIds: [],
};
const lines = [
  { variantId: 'panel-sku', quantity: 2 },
  { variantId: 'cable-sku', quantity: 1 },
];
const totals = (overrides: Partial<Parameters<typeof calculateTotals>[0]> = {}) =>
  calculateTotals({
    items: calculateCart(lines, products).items,
    products,
    shipping,
    district: 'Dhaka',
    minimumOrder: 10000,
    now,
    ...overrides,
  });

describe('authoritative cart calculations', () => {
  it('builds current SKU snapshots and sums integer poisha without discounting compare-at prices', () => {
    const cart = calculateCart(lines, products);
    expect(cart.subtotal).toBe(25000);
    expect(cart.items[0]).toMatchObject({
      unitPrice: 10000,
      lineTotal: 20000,
      quantity: 2,
      productName: 'Sample panel',
      sku: 'panel-SKU',
    });
    expect(calculateCart([], products)).toEqual({ items: [], subtotal: 0 });
  });

  it.each([0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid quantity %s',
    (quantity) => {
      expect(() => validateQuantity(quantity, products[0].variants[0])).toThrow(
        expect.objectContaining({ code: 'validation' }),
      );
    },
  );

  it('rejects deleted and duplicate SKUs, per-order limits and reserved stock shortages', () => {
    expect(() => calculateCart([{ variantId: 'deleted', quantity: 1 }], products)).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
    expect(() => calculateCart([lines[0], lines[0]], products)).toThrow(/duplicate/i);
    expect(() => validateQuantity(6, products[0].variants[0])).toThrow(/per-order/i);
    expect(() => calculateCart(lines, products, { 'panel-sku': 9 })).toThrow(
      expect.objectContaining({ code: 'conflict' }),
    );
    expect(() => validateQuantity(1, { ...products[0].variants[0], stock: 0 })).toThrow(/stock/i);
  });

  it('guards both line multiplication and aggregate overflow', () => {
    const expensive = product('expensive', Number.MAX_SAFE_INTEGER);
    expect(() => calculateCart([{ variantId: 'expensive-sku', quantity: 2 }], [expensive])).toThrow(
      /too large/i,
    );
    expect(() =>
      calculateCart(
        [
          { variantId: 'expensive-sku', quantity: 1 },
          { variantId: 'panel-sku', quantity: 1 },
        ],
        [expensive, ...products],
      ),
    ).toThrow(/too large/i);
  });
});

describe('coupon eligibility and totals', () => {
  it('normalizes a single coupon code and rejects unknown codes', () => {
    expect(findCoupon([coupon], ' solar10 ')).toBe(coupon);
    expect(findCoupon([coupon], '')).toBeUndefined();
    expect(() => findCoupon([coupon], 'INVALID')).toThrow(/invalid/i);
    expect(() => findCoupon([coupon], 'SOLAR10 OTHER')).toThrow(/invalid/i);
  });

  it('calculates capped discounts only on eligible product categories', () => {
    const restricted = { ...coupon, eligibleCategoryIds: ['panels'], maximumDiscount: 1500 };
    expect(totals({ coupon: restricted })).toMatchObject({
      subtotal: 25000,
      discount: 1500,
      shipping: 0,
      tax: 0,
      total: 23500,
    });
    expect(totals({ coupon: { ...restricted, maximumDiscount: null } }).discount).toBe(2000);
    expect(() => totals({ coupon: { ...coupon, eligibleCategoryIds: ['batteries'] } })).toThrow(
      /does not apply/i,
    );
  });

  it('caps fixed discounts at eligible subtotal and never returns negative totals', () => {
    expect(
      totals({
        coupon: { ...coupon, type: 'fixed', amount: 999999, eligibleCategoryIds: ['panels'] },
      }),
    ).toMatchObject({ discount: 20000, shipping: 1000, total: 6000 });
  });

  it('rejects expired/future coupons and unmet minimums at exact date boundaries', () => {
    expect(() => totals({ coupon: { ...coupon, endsAt: '2026-10-23T23:59:59Z' } })).toThrow(
      /expired/i,
    );
    expect(() => totals({ coupon: { ...coupon, startsAt: '2026-10-25T00:00:00Z' } })).toThrow(
      /not active/i,
    );
    expect(() => totals({ coupon: { ...coupon, minimumSubtotal: 25001 } })).toThrow(
      /coupon minimum/i,
    );
    expect(
      totals({ coupon: { ...coupon, startsAt: now.toISOString(), endsAt: now.toISOString() } })
        .discount,
    ).toBe(2500);
  });

  it('floors percentage rounding in integer poisha and avoids unsafe intermediates', () => {
    const odd = product('odd', 101);
    const oddItems = calculateCart([{ variantId: 'odd-sku', quantity: 1 }], [odd]);
    expect(couponDiscount({ ...coupon, minimumSubtotal: 0 }, oddItems.items, [odd], 101, now)).toBe(
      10,
    );
    const huge = product('huge', Number.MAX_SAFE_INTEGER);
    const hugeItems = calculateCart([{ variantId: 'huge-sku', quantity: 1 }], [huge]);
    expect(
      couponDiscount({ ...coupon, amount: 100 }, hugeItems.items, [huge], hugeItems.subtotal, now),
    ).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('uses discounted subtotal for free-delivery thresholds', () => {
    const items = calculateCart([{ variantId: 'panel-sku', quantity: 2 }], products).items;
    expect(totals({ items }).shipping).toBe(0);
    expect(totals({ items, coupon }).shipping).toBe(1000);
    expect(totals({ items, coupon }).total).toBe(19000);
  });

  it('supports valid free-delivery coupons without item discounts', () => {
    const items = calculateCart([{ variantId: 'panel-sku', quantity: 1 }], products).items;
    expect(
      totals({ items, coupon: { ...coupon, type: 'free_shipping', amount: 0 } }),
    ).toMatchObject({ subtotal: 10000, discount: 0, shipping: 0, total: 10000 });
  });

  it('validates district eligibility and minimum orders while matching case and whitespace', () => {
    expect(totals({ district: ' dhAKA ' }).total).toBe(25000);
    expect(() => totals({ district: 'Unsupported' })).toThrow(/district/i);
    expect(() => totals({ minimumOrder: 25001 })).toThrow(/minimum order/i);
    expect(() => totals({ items: [] })).toThrow(/add products/i);
  });

  it('requires refreshed price review and rejects tampered line arithmetic', () => {
    const items = calculateCart(lines, products).items;
    expect(() => totals({ items: [{ ...items[0], lineTotal: 1 }, items[1]] })).toThrow(
      expect.objectContaining({ code: 'conflict' }),
    );
    expect(() =>
      totals({ items: [{ ...items[0], unitPrice: 1, lineTotal: 2 }, items[1]] }),
    ).toThrow(/price has changed/i);
  });

  it('guards shipping addition overflow and negative configured money', () => {
    const expensive = product('expensive', Number.MAX_SAFE_INTEGER);
    const items = calculateCart([{ variantId: 'expensive-sku', quantity: 1 }], [expensive]).items;
    expect(() =>
      totals({ items, products: [expensive], shipping: { ...shipping, freeAbove: null } }),
    ).toThrow(/too large/i);
    expect(() => totals({ shipping: { ...shipping, fee: -1 } })).toThrow(/monetary/i);
  });
});

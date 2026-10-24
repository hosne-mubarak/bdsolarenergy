/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addressSchema,
  bannerSchema,
  brandSchema,
  categorySchema,
  contentPageSchema,
  couponSchema,
  imageSchema,
  navigationSchema,
  orderSchema,
  paymentMethodSchema,
  preferencesSchema,
  productSchema,
  reviewSchema,
  shippingSchema,
  siteSettingsSchema,
  userSchema,
} from '../schemas';
import { validateFixtureIntegrity, type FixtureSet } from '../schemas/fixture-integrity';

function read<T extends z.ZodTypeAny>(filename: string, schema: T): z.output<T> {
  return schema.parse(JSON.parse(readFileSync(resolve('src/data', `${filename}.json`), 'utf8')));
}

function loadFixtures(): FixtureSet {
  return {
    products: read('products', z.array(productSchema)),
    categories: read('categories', z.array(categorySchema)),
    brands: read('brands', z.array(brandSchema)),
    images: read('images', z.array(imageSchema)),
    reviews: read('reviews', z.array(reviewSchema)),
    banners: read('banners', z.array(bannerSchema)),
    navigation: read('navigation', z.array(navigationSchema)),
    users: read('users', z.array(userSchema)),
    addresses: read('addresses', z.array(addressSchema)),
    orders: read('orders', z.array(orderSchema)),
    coupons: read('coupons', z.array(couponSchema)),
    shipping: read('shipping', z.array(shippingSchema)),
    paymentMethods: read('payment-methods', z.array(paymentMethodSchema)),
    settings: read('site-settings', siteSettingsSchema),
    pages: read('pages', z.array(contentPageSchema)),
  };
}

describe('linked demo fixtures', () => {
  it('validates every record and all cross-record relationships', () => {
    expect(validateFixtureIntegrity(loadFixtures())).toEqual([]);
    expect(read('preferences', preferencesSchema)).toEqual(
      expect.objectContaining({
        orderUpdates: expect.any(Boolean),
        compactCards: expect.any(Boolean),
      }),
    );
  });

  it('covers all eight product groups, nested categories, brands and multiple pages', () => {
    const fixtures = loadFixtures();
    expect(fixtures.products.length).toBeGreaterThanOrEqual(40);
    expect(fixtures.brands.length).toBeGreaterThanOrEqual(4);
    const usedCategoryIds = new Set(fixtures.products.map((product) => product.categoryId));
    const leafCategories = fixtures.categories.filter(
      (category) => !fixtures.categories.some((other) => other.parentId === category.id),
    );
    expect(
      leafCategories.filter((category) => usedCategoryIds.has(category.id)).length,
    ).toBeGreaterThanOrEqual(8);
    expect(fixtures.categories.some((category) => category.parentId !== null)).toBe(true);
    expect(Math.ceil(fixtures.products.length / 12)).toBeGreaterThanOrEqual(3);
  });

  it('supplies deterministic variants, stock, discount, review and collection cases', () => {
    const fixtures = loadFixtures();
    const variants = fixtures.products.flatMap((product) => product.variants);
    expect(fixtures.products.some((product) => product.variants.length > 1)).toBe(true);
    expect(variants.some((variant) => variant.stock === 0)).toBe(true);
    expect(variants.some((variant) => variant.stock > 0 && variant.stock <= 3)).toBe(true);
    expect(
      variants.some(
        (variant) => variant.compareAtPrice !== null && variant.compareAtPrice > variant.price,
      ),
    ).toBe(true);
    expect(fixtures.reviews.length).toBeGreaterThanOrEqual(3);
    expect(fixtures.settings.collections.featured.length).toBeGreaterThan(0);
    expect(fixtures.settings.collections.bestSellers.length).toBeGreaterThan(0);
  });

  it('provides shipping, simulated payment and coupon eligibility edge cases', () => {
    const fixtures = loadFixtures();
    const now = Date.parse('2026-10-24T00:00:00Z');
    expect(fixtures.shipping.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(
        fixtures.paymentMethods.filter((method) => method.enabled).map((method) => method.type),
      ),
    ).toEqual(new Set(['cod', 'mobile', 'card']));
    expect(fixtures.paymentMethods.every((method) => method.demoOnly)).toBe(true);
    expect(
      fixtures.coupons.some(
        (coupon) => Date.parse(coupon.startsAt) <= now && Date.parse(coupon.endsAt) > now,
      ),
    ).toBe(true);
    expect(fixtures.coupons.some((coupon) => Date.parse(coupon.endsAt) < now)).toBe(true);
    expect(fixtures.coupons.some((coupon) => coupon.eligibleCategoryIds.length > 0)).toBe(true);
  });

  it('has local image assets, reserved dimensions and provenance', () => {
    for (const image of loadFixtures().images) {
      expect(existsSync(resolve('public', image.src.slice(1))), image.src).toBe(true);
      expect(image.attribution.trim().length).toBeGreaterThan(5);
      expect(image.alt.trim().length).toBeGreaterThan(3);
      expect(image.width).toBeGreaterThan(0);
      expect(image.height).toBeGreaterThan(0);
    }
  });

  it('provides every information page and FAQ content', () => {
    const pages = loadFixtures().pages;
    for (const slug of [
      'about',
      'contact',
      'faq',
      'shipping-delivery',
      'returns-refunds',
      'warranty',
      'privacy',
      'terms',
    ]) {
      expect(
        pages.some((page) => page.slug === slug),
        slug,
      ).toBe(true);
    }
    expect(pages.find((page) => page.slug === 'faq')?.faqs.length).toBeGreaterThan(0);
  });
});

describe('fixture integrity diagnostics', () => {
  it('detects a category cycle rather than traversing forever', () => {
    const fixtures = loadFixtures();
    fixtures.categories[0].parentId = fixtures.categories[0].id;
    expect(validateFixtureIntegrity(fixtures).some((error) => error.includes('cycle'))).toBe(true);
  });

  it('rejects a missing product reference and duplicate SKU across products', () => {
    const fixtures = loadFixtures();
    fixtures.reviews[0].productId = 'missing-product';
    fixtures.products[1].variants[0].sku = fixtures.products[0].variants[0].sku;
    const errors = validateFixtureIntegrity(fixtures);
    expect(errors).toContainEqual(expect.stringContaining('missing reference missing-product'));
    expect(errors).toContainEqual(expect.stringContaining('variants.sku: duplicate'));
  });

  it('rejects unknown navigation targets and broken parent/category relationships', () => {
    const fixtures = loadFixtures();
    fixtures.navigation[0].path = '/not-a-planned-route';
    fixtures.categories[0].parentId = 'missing-parent';
    const errors = validateFixtureIntegrity(fixtures);
    expect(errors).toContainEqual(expect.stringContaining('unknown route'));
    expect(errors).toContainEqual(expect.stringContaining('missing reference missing-parent'));
  });
});

import { describe, expect, it } from 'vitest';
import {
  addressInputSchema,
  addressSchema,
  bannerSchema,
  cartSchema,
  checkoutInputSchema,
  couponSchema,
  productQuerySchema,
  productSchema,
  registerInputSchema,
  reviewSchema,
  sessionSchema,
  storageEnvelopeSchema,
  userSchema,
  wishlistSchema,
} from './index';

const timestamp = '2026-10-01T00:00:00.000Z';
const variant = {
  id: 'variant-1',
  productId: 'product-1',
  sku: 'PANEL-1',
  attributes: { Wattage: '550W' },
  price: 1500000,
  compareAtPrice: 1600000,
  stock: 5,
  maxPerOrder: 3,
  weightGrams: 28000,
};
const product = {
  id: 'product-1',
  slug: 'solar-panel',
  categoryId: 'panels',
  brandId: 'brand-1',
  name: 'Sample panel',
  summary: 'A sample solar panel.',
  description: 'Demonstration catalogue record.',
  imageIds: ['image-1'],
  specifications: [{ label: 'Power', value: '550W' }],
  variants: [variant],
  tags: ['featured'],
  createdAt: timestamp,
  popularity: 12,
};
const address = {
  recipient: 'হোসনে মোবারক',
  phone: '+880 1712-345678',
  division: 'ঢাকা',
  district: 'Dhaka',
  area: 'মিরপুর',
  street: 'বাড়ি ১২, সড়ক ৩',
  postcode: '1216',
};
const registration = {
  displayName: 'Demo customer',
  email: 'DEMO@Example.com',
  password: 'demo-password',
  confirmPassword: 'demo-password',
  acceptTerms: true,
};

describe('catalogue schemas', () => {
  it('accepts an owned SKU, integer money and real UTC timestamp', () => {
    expect(productSchema.parse(product)).toEqual(product);
  });

  it.each([
    { ...product, variants: [] },
    { ...product, variants: [{ ...variant, productId: 'other-product' }] },
    { ...product, variants: [variant, variant] },
    { ...product, variants: [{ ...variant, price: -1 }] },
    { ...product, variants: [{ ...variant, compareAtPrice: variant.price }] },
    { ...product, variants: [{ ...variant, stock: 1.5 }] },
    { ...product, createdAt: '2026-10-01T06:00:00+06:00' },
    { ...product, slug: 'Not a slug' },
  ])('rejects invalid catalogue shape %# with a useful error path', (invalid) => {
    const result = productSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path.length).toBeGreaterThan(0);
  });

  it('bounds ratings and coupon percentages', () => {
    const review = {
      id: 'review-1',
      productId: product.id,
      displayName: 'Customer',
      rating: 5,
      title: 'Review',
      body: 'Demonstration review.',
      createdAt: timestamp,
    };
    expect(reviewSchema.safeParse(review).success).toBe(true);
    expect(reviewSchema.safeParse({ ...review, rating: 6 }).success).toBe(false);
    const coupon = {
      id: 'coupon-1',
      code: ' solar10 ',
      type: 'percentage',
      amount: 10,
      minimumSubtotal: 10000,
      maximumDiscount: null,
      startsAt: timestamp,
      endsAt: '2026-12-31T23:59:59Z',
      eligibleCategoryIds: [],
    };
    expect(couponSchema.parse(coupon).code).toBe('SOLAR10');
    expect(couponSchema.safeParse({ ...coupon, amount: 101 }).success).toBe(false);
    expect(couponSchema.safeParse({ ...coupon, endsAt: '2025-01-01T00:00:00Z' }).success).toBe(
      false,
    );
  });

  it('rejects external banner destinations and reversed intervals', () => {
    const banner = {
      id: 'banner-1',
      title: 'Sample',
      copy: 'Sample copy',
      imageId: 'image-1',
      ctaLabel: 'Browse',
      ctaPath: '/products',
      startsAt: timestamp,
      endsAt: null,
    };
    expect(bannerSchema.safeParse(banner).success).toBe(true);
    expect(
      bannerSchema.safeParse({
        ...banner,
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-01T00:00:00.500Z',
      }).success,
    ).toBe(true);
    expect(bannerSchema.safeParse({ ...banner, ctaPath: '//external.example' }).success).toBe(
      false,
    );
    expect(bannerSchema.safeParse({ ...banner, endsAt: '2025-01-01T00:00:00Z' }).success).toBe(
      false,
    );
  });
});

describe('customer and authentication schemas', () => {
  it('accepts Unicode Bangladesh addresses and normalizes a mobile number', () => {
    const parsed = addressInputSchema.parse(address);
    expect(parsed.phone).toBe('+8801712345678');
    expect(parsed.recipient).toBe(address.recipient);
    expect(parsed.isDefault).toBe(false);
    expect(addressSchema.safeParse({ ...parsed, id: 'address-1', userId: 'user-1' }).success).toBe(
      true,
    );
  });

  it('rejects invalid phone/postcode without restricting legitimate address scripts', () => {
    expect(addressInputSchema.safeParse({ ...address, phone: '123' }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...address, postcode: '12345' }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...address, postcode: '' }).success).toBe(true);
  });

  it('validates normalized registration, confirmation and policy agreement', () => {
    expect(registerInputSchema.parse(registration).email).toBe('demo@example.com');
    expect(registerInputSchema.safeParse({ ...registration, password: 'short' }).success).toBe(
      false,
    );
    const mismatch = registerInputSchema.safeParse({
      ...registration,
      confirmPassword: 'different',
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0].path).toEqual(['confirmPassword']);
    expect(registerInputSchema.safeParse({ ...registration, acceptTerms: false }).success).toBe(
      false,
    );
  });

  it('permits session metadata only and rejects persisted plaintext credentials', () => {
    expect(sessionSchema.safeParse({ userId: 'user-1', expiresAt: timestamp }).success).toBe(true);
    expect(
      sessionSchema.safeParse({ userId: 'user-1', expiresAt: timestamp, password: 'secret' })
        .success,
    ).toBe(false);
    const user = {
      id: 'user-1',
      displayName: 'Demo',
      email: 'demo@example.com',
      phone: '',
      demo: true,
      verified: false,
    };
    expect(userSchema.safeParse(user).success).toBe(true);
    expect(userSchema.safeParse({ ...user, password: 'secret' }).success).toBe(false);
  });
});

describe('shopping and persistence schemas', () => {
  it('requires unique positive cart lines and wishlist IDs', () => {
    const cart = {
      ownerKey: 'guest',
      lines: [{ variantId: 'variant-1', quantity: 2 }],
      updatedAt: timestamp,
    };
    expect(cartSchema.safeParse(cart).success).toBe(true);
    expect(cartSchema.safeParse({ ...cart, lines: [...cart.lines, ...cart.lines] }).success).toBe(
      false,
    );
    expect(
      cartSchema.safeParse({ ...cart, lines: [{ variantId: 'variant-1', quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      wishlistSchema.safeParse({
        ownerKey: 'guest',
        productIds: ['product-1', 'product-1'],
        updatedAt: timestamp,
      }).success,
    ).toBe(false);
  });

  it('validates storage versions and contents without interpreting migration policy', () => {
    const schema = storageEnvelopeSchema(sessionSchema);
    const envelope = {
      version: 1,
      updatedAt: timestamp,
      data: { userId: 'user-1', expiresAt: timestamp },
    };
    expect(schema.safeParse(envelope).success).toBe(true);
    expect(schema.safeParse({ ...envelope, version: 0 }).success).toBe(false);
    expect(schema.safeParse({ ...envelope, version: 1.5 }).success).toBe(false);
    expect(schema.safeParse({ ...envelope, data: {} }).success).toBe(false);
  });

  it('requires explicit demo acknowledgement at checkout', () => {
    const input = {
      address,
      shippingMethodId: 'dhaka',
      paymentMethodId: 'cod',
      acceptedDemo: true,
    };
    expect(checkoutInputSchema.parse(input).couponCode).toBe('');
    expect(checkoutInputSchema.safeParse({ ...input, acceptedDemo: false }).success).toBe(false);
  });

  it('defaults and validates query pagination and price ranges', () => {
    expect(productQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 12,
      availability: 'all',
    });
    expect(productQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(productQuerySchema.safeParse({ minimumPrice: 20000, maximumPrice: 10000 }).success).toBe(
      false,
    );
  });
});

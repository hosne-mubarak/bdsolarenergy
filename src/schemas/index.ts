import { z } from 'zod';

export const idSchema = z.string().trim().min(1).max(100);
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a URL-safe slug');
export const moneySchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const quantitySchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const utcTimestampSchema = z.string().datetime({ offset: false });
export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine(
    (value) => /^(?:\+?88)?01[3-9]\d{8}$/.test(value),
    'Enter a valid Bangladesh mobile number',
  );
export const internalPathSchema = z
  .string()
  .refine(
    (value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'),
    'Use an internal application path',
  );
const text = z.string().trim().min(1);
const stockSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const categorySchema = z.object({
  id: idSchema,
  slug: slugSchema,
  name: text,
  parentId: idSchema.nullable(),
  imageId: idSchema,
  sortOrder: z.number().int().nonnegative(),
});
export const brandSchema = z.object({ id: idSchema, slug: slugSchema, name: text });
export const imageSchema = z.object({
  id: idSchema,
  src: z.string().regex(/^\/images\/[a-zA-Z0-9/_-]+\.(svg|png|webp|jpe?g)$/, 'Use a local image'),
  alt: text,
  width: quantitySchema,
  height: quantitySchema,
  attribution: text,
});
export const variantSchema = z
  .object({
    id: idSchema,
    productId: idSchema,
    sku: text,
    attributes: z.record(z.string()),
    price: moneySchema,
    compareAtPrice: moneySchema.nullable(),
    stock: stockSchema,
    maxPerOrder: quantitySchema,
    weightGrams: stockSchema,
  })
  .refine((variant) => variant.compareAtPrice === null || variant.compareAtPrice > variant.price, {
    path: ['compareAtPrice'],
    message: 'Compare-at price must exceed the selling price',
  });
export const productSchema = z
  .object({
    id: idSchema,
    slug: slugSchema,
    categoryId: idSchema,
    brandId: idSchema,
    name: text,
    summary: text,
    description: text,
    imageIds: z.array(idSchema).min(1),
    specifications: z.array(z.object({ label: text, value: text })),
    variants: z.array(variantSchema).min(1),
    tags: z.array(text),
    createdAt: utcTimestampSchema,
    popularity: stockSchema,
  })
  .superRefine((product, context) => {
    const ids = new Set<string>();
    product.variants.forEach((variant, index) => {
      if (variant.productId !== product.id)
        context.addIssue({
          code: 'custom',
          path: ['variants', index, 'productId'],
          message: 'Variant must belong to its containing product',
        });
      if (ids.has(variant.id))
        context.addIssue({
          code: 'custom',
          path: ['variants', index, 'id'],
          message: 'Duplicate variant ID',
        });
      ids.add(variant.id);
    });
  });
export const reviewSchema = z.object({
  id: idSchema,
  productId: idSchema,
  displayName: text,
  rating: z.number().int().min(1).max(5),
  title: text,
  body: text,
  createdAt: utcTimestampSchema,
});
export const bannerSchema = z
  .object({
    id: idSchema,
    title: text,
    copy: text,
    imageId: idSchema,
    ctaLabel: text,
    ctaPath: internalPathSchema,
    startsAt: utcTimestampSchema.nullable(),
    endsAt: utcTimestampSchema.nullable(),
  })
  .refine(
    (value) =>
      !value.startsAt || !value.endsAt || Date.parse(value.endsAt) >= Date.parse(value.startsAt),
    {
      path: ['endsAt'],
      message: 'End must follow start',
    },
  );
export const navigationSchema = z.object({
  id: idSchema,
  label: text,
  path: internalPathSchema,
  parentId: idSchema.nullable(),
  order: stockSchema,
});
export const contentPageSchema = z.object({
  slug: slugSchema,
  title: text,
  sections: z.array(z.object({ heading: text, body: text })).min(1),
  faqs: z.array(z.object({ question: text, answer: text })).default([]),
  updatedAt: utcTimestampSchema,
});
export const shippingSchema = z.object({
  id: idSchema,
  label: text,
  districts: z.array(text).min(1),
  fee: moneySchema,
  freeAbove: moneySchema.nullable(),
  estimatedDays: z
    .object({ min: stockSchema, max: quantitySchema })
    .refine((value) => value.max >= value.min, 'Maximum days must follow minimum'),
});
export const paymentMethodSchema = z.object({
  id: idSchema,
  label: text,
  description: text,
  enabled: z.boolean(),
  demoOnly: z.literal(true),
  type: z.enum(['cod', 'mobile', 'card']),
});
export const couponSchema = z
  .object({
    id: idSchema,
    code: text.transform((value) => value.toUpperCase()),
    type: z.enum(['percentage', 'fixed', 'free_shipping']),
    amount: moneySchema,
    minimumSubtotal: moneySchema,
    maximumDiscount: moneySchema.nullable(),
    startsAt: utcTimestampSchema,
    endsAt: utcTimestampSchema,
    eligibleCategoryIds: z.array(idSchema),
  })
  .superRefine((value, context) => {
    if (Date.parse(value.endsAt) < Date.parse(value.startsAt))
      context.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must follow start' });
    if (value.type === 'percentage' && value.amount > 100)
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Percentage cannot exceed 100',
      });
    if (value.type === 'free_shipping' && value.amount !== 0)
      context.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Free shipping has no item discount amount',
      });
  });
export const siteSettingsSchema = z.object({
  name: text,
  currency: z.literal('BDT'),
  contact: z.object({ email: emailSchema, phone: phoneSchema, address: text }),
  collections: z.object({ featured: z.array(idSchema), bestSellers: z.array(idSchema) }),
  minimumOrder: moneySchema,
  taxInclusive: z.literal(true),
  demoNotice: text,
});

export const preferencesSchema = z.object({ orderUpdates: z.boolean(), compactCards: z.boolean() });
export const userSchema = z
  .object({
    id: idSchema,
    displayName: z.string().trim().min(2).max(100),
    email: emailSchema,
    phone: z.union([phoneSchema, z.literal('')]),
    demo: z.literal(true),
    verified: z.boolean(),
  })
  .strict();
export const credentialSchema = z
  .object({
    salt: text,
    hash: text,
    iterations: z.number().int().min(100_000),
    algorithm: z.literal('PBKDF2-SHA-256'),
  })
  .strict();
export const storedIdentitySchema = z
  .object({ user: userSchema, credential: credentialSchema.nullable() })
  .strict();
export const sessionSchema = z.object({ userId: idSchema, expiresAt: utcTimestampSchema }).strict();
export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: z.union([phoneSchema, z.literal('')]),
});
const addressFields = {
  recipient: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  division: text,
  district: text,
  area: text,
  street: z.string().trim().min(3).max(300),
  postcode: z.string().regex(/^(?:\d{4})?$/, 'Use a four-digit postal code or leave blank'),
};
export const addressInputSchema = z.object({
  ...addressFields,
  isDefault: z.boolean().default(false),
});
export const addressSchema = z.object({
  id: idSchema,
  userId: idSchema,
  ...addressFields,
  isDefault: z.boolean(),
});
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);
export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  remember: z.boolean().default(false),
});
export const registerInputSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine(Boolean, 'Accept the terms to continue'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });
export const resetPasswordInputSchema = z
  .object({ intentId: idSchema, password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });
export const changePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match',
  });
export const resetIntentSchema = z.object({
  id: idSchema,
  userId: idSchema,
  expiresAt: utcTimestampSchema,
  used: z.boolean(),
});
export const contactInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  message: z.string().trim().min(10).max(3000),
});

export const cartLineSchema = z.object({ variantId: idSchema, quantity: quantitySchema }).strict();
export const cartSchema = z
  .object({ ownerKey: idSchema, lines: z.array(cartLineSchema), updatedAt: utcTimestampSchema })
  .superRefine((value, context) => {
    if (new Set(value.lines.map((line) => line.variantId)).size !== value.lines.length)
      context.addIssue({ code: 'custom', path: ['lines'], message: 'Duplicate cart SKU' });
  });
export const wishlistSchema = z
  .object({ ownerKey: idSchema, productIds: z.array(idSchema), updatedAt: utcTimestampSchema })
  .refine((value) => new Set(value.productIds).size === value.productIds.length, {
    path: ['productIds'],
    message: 'Wishlist IDs must be unique',
  });
export const orderItemSchema = z.object({
  productId: idSchema,
  variantId: idSchema,
  productName: text,
  sku: text,
  imageId: idSchema,
  quantity: quantitySchema,
  unitPrice: moneySchema,
  lineTotal: moneySchema,
});
export const totalsSchema = z.object({
  subtotal: moneySchema,
  discount: moneySchema,
  shipping: moneySchema,
  tax: moneySchema,
  total: moneySchema,
});
export const orderStatusSchema = z.enum([
  'placed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);
export const trackingEventSchema = z.object({
  status: orderStatusSchema,
  label: text,
  at: utcTimestampSchema,
});
export const orderSchema = z.object({
  id: idSchema,
  userId: idSchema,
  idempotencyKey: idSchema,
  status: orderStatusSchema,
  items: z.array(orderItemSchema).min(1),
  address: addressSchema,
  totals: totalsSchema,
  shippingMethodId: idSchema,
  paymentMethodId: idSchema,
  couponCode: z.string().nullable(),
  createdAt: utcTimestampSchema,
  tracking: z.array(trackingEventSchema),
  demoOnly: z.literal(true),
});
export const checkoutInputSchema = z.object({
  address: addressInputSchema,
  shippingMethodId: idSchema,
  paymentMethodId: idSchema,
  couponCode: z.string().trim().max(50).default(''),
  acceptedDemo: z.literal(true, {
    errorMap: () => ({ message: 'Acknowledge this is a demo order' }),
  }),
  expectedQuoteId: idSchema.optional(),
});
export const quoteSchema = z.object({
  id: idSchema,
  ownerKey: idSchema,
  items: z.array(orderItemSchema),
  totals: totalsSchema,
  expiresAt: utcTimestampSchema,
  input: checkoutInputSchema,
});
export const checkoutAggregateSchema = z.object({
  revision: stockSchema,
  carts: z.record(cartSchema),
  orders: z.array(orderSchema),
  reservations: z.record(stockSchema),
});

export function storageEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z
    .object({
      version: z.number().int().positive(),
      updatedAt: utcTimestampSchema,
      data: dataSchema,
    })
    .strict();
}

export const productQuerySchema = z
  .object({
    text: z.string().default(''),
    categoryId: idSchema.optional(),
    brandIds: z.array(idSchema).default([]),
    minimumPrice: moneySchema.optional(),
    maximumPrice: moneySchema.optional(),
    availability: z.enum(['all', 'in_stock', 'out_of_stock']).default('all'),
    collection: z
      .enum(['all', 'featured', 'best-sellers', 'new-arrivals', 'offers'])
      .default('all'),
    sort: z
      .enum(['featured', 'price-asc', 'price-desc', 'newest', 'popularity', 'rating'])
      .default('featured'),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(12),
  })
  .refine(
    (query) =>
      query.minimumPrice === undefined ||
      query.maximumPrice === undefined ||
      query.maximumPrice >= query.minimumPrice,
    { path: ['maximumPrice'], message: 'Maximum price must not be below minimum price' },
  );

export const resetRequestInputSchema = z.object({ email: emailSchema });

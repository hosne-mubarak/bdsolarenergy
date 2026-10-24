import type {
  Address,
  Banner,
  Brand,
  Category,
  ContentPage,
  Coupon,
  NavigationItem,
  Order,
  PaymentMethod,
  Product,
  ProductImage,
  Review,
  ShippingMethod,
  SiteSettings,
  User,
} from '../types';

export interface FixtureSet {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  images: ProductImage[];
  reviews: Review[];
  banners: Banner[];
  navigation: NavigationItem[];
  users: User[];
  addresses: Address[];
  orders: Order[];
  coupons: Coupon[];
  shipping: ShippingMethod[];
  paymentMethods: PaymentMethod[];
  settings: SiteSettings;
  pages: ContentPage[];
}

const staticRoutes = new Set([
  '/',
  '/products',
  '/search',
  '/featured',
  '/best-sellers',
  '/new-arrivals',
  '/offers',
  '/cart',
  '/wishlist',
  '/checkout',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/logout',
  '/unauthorized',
  '/account',
  '/account/profile',
  '/account/profile/edit',
  '/account/password',
  '/account/addresses',
  '/account/addresses/new',
  '/account/orders',
  '/account/wishlist',
  '/account/settings',
  '/about',
  '/contact',
  '/faq',
  '/shipping-delivery',
  '/returns-refunds',
  '/warranty',
  '/privacy',
  '/terms',
]);

/** Report cross-record fixture defects without depending on browser state or React. */
export function validateFixtureIntegrity(fixtures: FixtureSet): string[] {
  const errors: string[] = [];
  const unique = (values: string[], location: string) => {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${location}: duplicate ${value}`);
      seen.add(value);
    }
    return seen;
  };
  const reference = (value: string, ids: Set<string>, location: string) => {
    if (!ids.has(value)) errors.push(`${location}: missing reference ${value}`);
  };
  const productIds = unique(
    fixtures.products.map((record) => record.id),
    'products.id',
  );
  unique(
    fixtures.products.map((record) => record.slug),
    'products.slug',
  );
  const categoryIds = unique(
    fixtures.categories.map((record) => record.id),
    'categories.id',
  );
  unique(
    fixtures.categories.map((record) => record.slug),
    'categories.slug',
  );
  const brandIds = unique(
    fixtures.brands.map((record) => record.id),
    'brands.id',
  );
  unique(
    fixtures.brands.map((record) => record.slug),
    'brands.slug',
  );
  const imageIds = unique(
    fixtures.images.map((record) => record.id),
    'images.id',
  );
  const userIds = unique(
    fixtures.users.map((record) => record.id),
    'users.id',
  );
  unique(
    fixtures.users.map((record) => record.email.toLowerCase()),
    'users.email',
  );
  const navIds = unique(
    fixtures.navigation.map((record) => record.id),
    'navigation.id',
  );
  const shippingIds = unique(
    fixtures.shipping.map((record) => record.id),
    'shipping.id',
  );
  const paymentIds = unique(
    fixtures.paymentMethods.map((record) => record.id),
    'paymentMethods.id',
  );
  unique(
    fixtures.reviews.map((record) => record.id),
    'reviews.id',
  );
  unique(
    fixtures.banners.map((record) => record.id),
    'banners.id',
  );
  unique(
    fixtures.addresses.map((record) => record.id),
    'addresses.id',
  );
  unique(
    fixtures.orders.map((record) => record.id),
    'orders.id',
  );
  unique(
    fixtures.coupons.map((record) => record.id),
    'coupons.id',
  );
  unique(
    fixtures.coupons.map((record) => record.code.toUpperCase()),
    'coupons.code',
  );
  unique(
    fixtures.pages.map((record) => record.slug),
    'pages.slug',
  );
  const variants = fixtures.products.flatMap((product) => product.variants);
  const variantIds = unique(
    variants.map((record) => record.id),
    'variants.id',
  );
  unique(
    variants.map((record) => record.sku),
    'variants.sku',
  );

  for (const category of fixtures.categories) {
    reference(category.imageId, imageIds, `category:${category.id}.imageId`);
    if (category.parentId)
      reference(category.parentId, categoryIds, `category:${category.id}.parentId`);
    const seen = new Set([category.id]);
    let parentId = category.parentId;
    while (parentId) {
      if (seen.has(parentId)) {
        errors.push(`categories: cycle at ${parentId}`);
        break;
      }
      seen.add(parentId);
      parentId = fixtures.categories.find((record) => record.id === parentId)?.parentId ?? null;
    }
  }
  for (const product of fixtures.products) {
    reference(product.categoryId, categoryIds, `product:${product.id}.categoryId`);
    reference(product.brandId, brandIds, `product:${product.id}.brandId`);
    for (const imageId of product.imageIds)
      reference(imageId, imageIds, `product:${product.id}.imageIds`);
    for (const variant of product.variants) {
      if (variant.productId !== product.id)
        errors.push(`variant:${variant.id}: wrong product owner`);
    }
  }
  for (const review of fixtures.reviews)
    reference(review.productId, productIds, `review:${review.id}.productId`);
  for (const coupon of fixtures.coupons) {
    for (const id of coupon.eligibleCategoryIds)
      reference(id, categoryIds, `coupon:${coupon.id}.eligibleCategoryIds`);
  }
  for (const address of fixtures.addresses)
    reference(address.userId, userIds, `address:${address.id}.userId`);
  const isKnownPath = (path: string) => {
    const pathname = path.split(/[?#]/)[0];
    if (staticRoutes.has(pathname)) return true;
    if (pathname.startsWith('/product/'))
      return fixtures.products.some((product) => pathname === `/product/${product.slug}`);
    if (pathname.startsWith('/category/')) {
      const slugs = pathname.slice('/category/'.length).split('/');
      const category = fixtures.categories.find((record) => record.slug === slugs[0]);
      if (!category) return false;
      if (slugs.length === 1) return true;
      return (
        slugs.length === 2 &&
        fixtures.categories.some(
          (record) => record.slug === slugs[1] && record.parentId === category.id,
        )
      );
    }
    return false;
  };
  for (const banner of fixtures.banners) {
    reference(banner.imageId, imageIds, `banner:${banner.id}.imageId`);
    if (!isKnownPath(banner.ctaPath))
      errors.push(`banner:${banner.id}: unknown CTA route ${banner.ctaPath}`);
  }
  for (const item of fixtures.navigation) {
    if (item.parentId) reference(item.parentId, navIds, `navigation:${item.id}.parentId`);
    if (!isKnownPath(item.path)) errors.push(`navigation:${item.id}: unknown route ${item.path}`);
  }
  for (const ids of Object.values(fixtures.settings.collections)) {
    for (const id of ids) reference(id, productIds, 'settings.collections');
  }
  for (const order of fixtures.orders) {
    reference(order.userId, userIds, `order:${order.id}.userId`);
    reference(order.shippingMethodId, shippingIds, `order:${order.id}.shippingMethodId`);
    reference(order.paymentMethodId, paymentIds, `order:${order.id}.paymentMethodId`);
    if (order.address.userId !== order.userId)
      errors.push(`order:${order.id}: address owner mismatch`);
    for (const line of order.items) {
      reference(line.productId, productIds, `order:${order.id}.items.productId`);
      reference(line.variantId, variantIds, `order:${order.id}.items.variantId`);
      const variant = variants.find((record) => record.id === line.variantId);
      if (variant && variant.productId !== line.productId)
        errors.push(`order:${order.id}: SKU product mismatch`);
    }
  }
  return errors;
}

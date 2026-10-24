import { productQuerySchema } from '../../schemas';
import { selectCatalogue } from '../../domain/catalogue/query';
import type { Product, ProductSummary } from '../../types';
import type { CatalogueRepository, ContentRepository, ReadOptions, Runtime } from '../contracts';
import { RepositoryError, throwIfAborted } from '../errors';
import { validateInput } from '../validation';
import { loadFixtureData, type FixtureData } from './fixtures';

export function createJsonReadRepositories(
  runtime: Runtime,
  fixtureData: FixtureData = loadFixtureData(),
): { catalogue: CatalogueRepository; content: ContentRepository } {
  // Own a snapshot; callers can never mutate the imported fixture singleton.
  const { fixtures: data, preferences, accountNavigation } = structuredClone(fixtureData);
  async function read<T>(operation: () => T, options?: ReadOptions): Promise<T> {
    throwIfAborted(options?.signal);
    await Promise.resolve();
    throwIfAborted(options?.signal);
    return structuredClone(operation());
  }
  function productById(id: string) {
    const product = data.products.find((item) => item.id === id);
    if (!product) throw new RepositoryError('not_found', 'This product is no longer available.');
    return product;
  }
  function summary(product: Product): ProductSummary {
    const reviews = data.reviews.filter((review) => review.productId === product.id);
    return {
      ...product,
      rating: reviews.length
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        : 0,
      reviewCount: reviews.length,
    };
  }
  const catalogue: CatalogueRepository = {
    listProducts: (input, options) =>
      read(() => {
        const query = validateInput(productQuerySchema, input);
        return selectCatalogue(data.products.map(summary), query, data.categories, data.settings);
      }, options),
    getProduct: (slug, options) =>
      read(() => {
        const product = data.products.find((item) => item.slug === slug);
        if (!product) throw new RepositoryError('not_found', 'This product could not be found.');
        return summary(product);
      }, options),
    getProductById: (id, options) => read(() => summary(productById(id)), options),
    getVariant: (id, options) =>
      read(() => {
        for (const product of data.products) {
          const variant = product.variants.find((item) => item.id === id);
          if (variant) return { product, variant };
        }
        throw new RepositoryError('not_found', 'This product option is no longer available.');
      }, options),
    listCategories: (options) =>
      read(() => [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder), options),
    listBrands: (options) => read(() => data.brands, options),
    listImages: (options) => read(() => data.images, options),
    getReviews: (id, options) =>
      read(() => {
        productById(id);
        return data.reviews.filter((item) => item.productId === id);
      }, options),
  };
  const content: ContentRepository = {
    getAccountNavigation: (options) =>
      read(() => [...accountNavigation].sort((a, b) => a.order - b.order), options),
    getSiteSettings: (options) => read(() => data.settings, options),
    getNavigation: (options) =>
      read(() => [...data.navigation].sort((a, b) => a.order - b.order), options),
    getBanners: (options) =>
      read(() => {
        const now = runtime.now().getTime();
        return data.banners.filter(
          (banner) =>
            (!banner.startsAt || Date.parse(banner.startsAt) <= now) &&
            (!banner.endsAt || now <= Date.parse(banner.endsAt)),
        );
      }, options),
    getPage: (slug, options) =>
      read(() => {
        const page = data.pages.find((item) => item.slug === slug);
        if (!page)
          throw new RepositoryError('not_found', 'This information page could not be found.');
        return page;
      }, options),
    getCheckoutConfiguration: (options) =>
      read(
        () => ({
          shipping: data.shipping,
          payments: data.paymentMethods,
          coupons: data.coupons,
          minimumOrder: data.settings.minimumOrder,
          taxInclusive: data.settings.taxInclusive,
        }),
        options,
      ),
    getCoupons: (options) => read(() => data.coupons, options),
    getDefaultPreferences: (options) => read(() => preferences, options),
  };
  return { catalogue, content };
}

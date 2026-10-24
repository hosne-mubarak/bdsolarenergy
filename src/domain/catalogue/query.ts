import type { Category, Page, ProductQuery, ProductSummary, SiteSettings } from '../../types';

export function resolveCategoryRoute(
  categories: Category[],
  slug: string,
  subslug?: string,
): Category | undefined {
  const parent = categories.find((category) => category.slug === slug);
  if (!parent || !subslug) return subslug ? undefined : parent;
  return categories.find(
    (category) => category.slug === subslug && category.parentId === parent.id,
  );
}

export function descendantCategoryIds(categories: Category[], categoryId: string): Set<string> {
  if (!categories.some((category) => category.id === categoryId)) return new Set();
  const visited = new Set<string>();
  const pending = [categoryId];
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const category of categories) {
      if (category.parentId === current && !visited.has(category.id)) pending.push(category.id);
    }
  }
  return visited;
}

function compareIds(a: ProductSummary, b: ProductSummary) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Catalogue filters/cards compare current minimum SKU prices, including unavailable SKUs. */
export function minimumProductPrice(product: ProductSummary): number {
  return Math.min(...product.variants.map((variant) => variant.price));
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en');
}

/** Filter first, retain deterministic collection ordering, and paginate last. */
export function selectCatalogue(
  products: ProductSummary[],
  query: ProductQuery,
  categories: Category[],
  settings: SiteSettings,
): Page<ProductSummary> {
  let items = [...products];
  if (query.categoryId) {
    const ids = descendantCategoryIds(categories, query.categoryId);
    items = items.filter((product) => ids.has(product.categoryId));
  }
  const searchTokens = normalizeSearchText(query.text).trim().split(/\s+/).filter(Boolean);
  if (searchTokens.length) {
    items = items.filter((product) => {
      const searchable = normalizeSearchText(
        [
          product.name,
          product.summary,
          product.description,
          ...product.specifications.flatMap((entry) => [entry.label, entry.value]),
          ...product.variants.map((variant) => variant.sku),
        ].join(' '),
      );
      return searchTokens.every((token) => searchable.includes(token));
    });
  }
  if (query.collection === 'featured' || query.collection === 'best-sellers') {
    const ids =
      query.collection === 'featured'
        ? settings.collections.featured
        : settings.collections.bestSellers;
    const order = new Map(ids.map((id, index) => [id, index]));
    items = items
      .filter((product) => order.has(product.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)! || compareIds(a, b));
  } else if (query.collection === 'offers') {
    items = items.filter((product) =>
      product.variants.some(
        (variant) => variant.compareAtPrice !== null && variant.compareAtPrice > variant.price,
      ),
    );
  } else if (query.collection === 'new-arrivals') {
    items = items
      .filter((product) => product.tags.includes('new'))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || compareIds(a, b));
  }
  if (query.brandIds.length)
    items = items.filter((product) => query.brandIds.includes(product.brandId));
  if (query.minimumPrice !== undefined)
    items = items.filter((product) => minimumProductPrice(product) >= query.minimumPrice!);
  if (query.maximumPrice !== undefined)
    items = items.filter((product) => minimumProductPrice(product) <= query.maximumPrice!);
  if (query.availability !== 'all') {
    items = items.filter((product) => {
      const available = product.variants.some((variant) => variant.stock > 0);
      return query.availability === 'in_stock' ? available : !available;
    });
  }
  if (query.sort !== 'featured') {
    items.sort((a, b) => {
      let comparison = 0;
      switch (query.sort) {
        case 'price-asc':
          comparison = minimumProductPrice(a) - minimumProductPrice(b);
          break;
        case 'price-desc':
          comparison = minimumProductPrice(b) - minimumProductPrice(a);
          break;
        case 'newest':
          comparison = Date.parse(b.createdAt) - Date.parse(a.createdAt);
          break;
        case 'popularity':
          comparison = b.popularity - a.popularity;
          break;
        case 'rating':
          comparison = b.rating - a.rating;
          break;
      }
      return comparison || compareIds(a, b);
    });
  }
  const total = items.length;
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.pageSize)));
  return {
    items: items.slice((page - 1) * query.pageSize, page * query.pageSize),
    total,
    page,
    pageSize: query.pageSize,
  };
}

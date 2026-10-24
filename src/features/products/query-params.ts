import { productQuerySchema } from '../../schemas';
import type { ProductQuery } from '../../types';

export function parseCatalogueQuery(
  params: URLSearchParams,
  collection: ProductQuery['collection'] = 'all',
): ProductQuery {
  const amount = (key: string) => {
    const raw = params.get(key);
    if (!raw || !/^\d+(?:\.\d{1,2})?$/.test(raw)) return undefined;
    const value = Math.round(Number(raw) * 100);
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  };
  const page = Number(params.get('page') ?? 1);
  const result = productQuerySchema.safeParse({
    collection,
    text: params.get('q') ?? '',
    brandIds: params.getAll('brand').filter(Boolean),
    minimumPrice: amount('min'),
    maximumPrice: amount('max'),
    availability: params.get('stock') ?? 'all',
    sort: params.get('sort') ?? 'featured',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  });
  if (result.success) return result.data;
  // Invalid optional URL values recover to safe, deterministic defaults.
  return productQuerySchema.parse({ collection, text: params.get('q') ?? '', page: 1 });
}

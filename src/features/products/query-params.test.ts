import { describe, expect, it } from 'vitest';
import { parseCatalogueQuery } from './query-params';

describe('catalogue URL state', () => {
  it('parses shareable repeated brands, BDT range, availability, sort and page', () => {
    const result = parseCatalogueQuery(
      new URLSearchParams(
        'brand=brand-1&brand=brand-2&min=100.50&max=2500&stock=in_stock&sort=price-desc&page=2',
      ),
    );
    expect(result).toMatchObject({
      brandIds: ['brand-1', 'brand-2'],
      minimumPrice: 10050,
      maximumPrice: 250000,
      availability: 'in_stock',
      sort: 'price-desc',
      page: 2,
    });
  });
  it.each(['min=no&max=-1&page=Infinity&sort=wrong', 'min=50&max=10', 'stock=unknown', 'page=0'])(
    'normalizes malformed optional params safely: %s',
    (raw) => {
      expect(parseCatalogueQuery(new URLSearchParams(raw))).toMatchObject({
        page: 1,
        sort: 'featured',
        brandIds: [],
        availability: 'all',
      });
    },
  );
});

import { describe, expect, it } from 'vitest';
import { productQuerySchema } from '../../schemas';
import type { Category, ProductSummary, SiteSettings } from '../../types';
import { descendantCategoryIds, resolveCategoryRoute, selectCatalogue } from './query';

const categories: Category[] = [
  { id: 'solar', slug: 'solar', name: 'Solar', parentId: null, imageId: 'image-1', sortOrder: 0 },
  {
    id: 'panels',
    slug: 'panels',
    name: 'Panels',
    parentId: 'solar',
    imageId: 'image-1',
    sortOrder: 1,
  },
  { id: 'mono', slug: 'mono', name: 'Mono', parentId: 'panels', imageId: 'image-1', sortOrder: 2 },
  {
    id: 'cables',
    slug: 'cables',
    name: 'Cables',
    parentId: null,
    imageId: 'image-1',
    sortOrder: 3,
  },
];
const settings: SiteSettings = {
  name: 'Demo',
  currency: 'BDT',
  contact: { email: 'demo@example.com', phone: '01700000000', address: 'Sample address' },
  collections: { featured: ['product-2', 'product-1'], bestSellers: ['product-3', 'product-2'] },
  minimumOrder: 0,
  taxInclusive: true,
  demoNotice: 'Sample only',
};
function product(
  id: number,
  categoryId: string,
  overrides: Partial<ProductSummary> = {},
): ProductSummary {
  return {
    id: `product-${id}`,
    slug: `product-${id}`,
    categoryId,
    brandId: 'brand-1',
    name: `Sample ${id}`,
    summary: 'Sample',
    description: 'Sample description',
    imageIds: ['image-1'],
    specifications: [],
    variants: [
      {
        id: `variant-${id}`,
        productId: `product-${id}`,
        sku: `SKU-${id}`,
        attributes: {},
        price: 10000,
        compareAtPrice: null,
        stock: 5,
        maxPerOrder: 3,
        weightGrams: 1000,
      },
    ],
    tags: [],
    createdAt: '2026-01-01T00:00:00Z',
    popularity: 1,
    rating: 0,
    reviewCount: 0,
    ...overrides,
  };
}
const products = [product(1, 'panels'), product(2, 'mono'), product(3, 'cables')];
const select = (input: Parameters<typeof productQuerySchema.parse>[0] = {}, records = products) =>
  selectCatalogue(records, productQuerySchema.parse(input), categories, settings);

describe('category route resolution and collection selection', () => {
  it('resolves single categories and validates direct parent/subcategory relationships', () => {
    expect(resolveCategoryRoute(categories, 'solar')?.id).toBe('solar');
    expect(resolveCategoryRoute(categories, 'solar', 'panels')?.id).toBe('panels');
    expect(resolveCategoryRoute(categories, 'solar', 'cables')).toBeUndefined();
    expect(resolveCategoryRoute(categories, 'missing')).toBeUndefined();
    expect(resolveCategoryRoute(categories, 'missing', 'panels')).toBeUndefined();
  });

  it('includes nested descendants while retaining unrelated category isolation', () => {
    expect(select({ categoryId: 'solar' }).items.map((record) => record.id)).toEqual([
      'product-1',
      'product-2',
    ]);
    expect(select({ categoryId: 'panels' }).total).toBe(2);
    expect(select({ categoryId: 'cables' }).items.map((record) => record.id)).toEqual([
      'product-3',
    ]);
    expect(select({ categoryId: 'missing' }).total).toBe(0);
  });

  it('terminates descendant traversal when malformed categories contain a cycle', () => {
    const cycle = categories.map((category) =>
      category.id === 'solar' ? { ...category, parentId: 'mono' } : category,
    );
    expect([...descendantCategoryIds(cycle, 'solar')].sort()).toEqual(['mono', 'panels', 'solar']);
  });

  it('uses configured collection IDs and ordering without duplicating product objects', () => {
    expect(select({ collection: 'featured' }).items.map((record) => record.id)).toEqual([
      'product-2',
      'product-1',
    ]);
    expect(select({ collection: 'best-sellers' }).items.map((record) => record.id)).toEqual([
      'product-3',
      'product-2',
    ]);
    expect(
      select({ categoryId: 'panels', collection: 'best-sellers' }).items.map((record) => record.id),
    ).toEqual(['product-2']);
  });

  it('selects offers from discounted SKUs and newest items with stable ID tie breaks', () => {
    const discounted = product(4, 'panels');
    discounted.variants[0].compareAtPrice = 12000;
    const older = product(5, 'panels', { tags: ['new'], createdAt: '2026-01-01T00:00:00Z' });
    const newer = product(6, 'panels', { tags: ['new'], createdAt: '2026-02-01T00:00:00Z' });
    const tied = product(7, 'panels', { tags: ['new'], createdAt: newer.createdAt });
    const records = [tied, discounted, older, newer];
    expect(select({ collection: 'offers' }, records).items.map((record) => record.id)).toEqual([
      'product-4',
    ]);
    expect(
      select({ collection: 'new-arrivals' }, records).items.map((record) => record.id),
    ).toEqual(['product-6', 'product-7', 'product-5']);
    expect(records[0].id).toBe('product-7');
  });

  it('paginates the filtered set and normalizes pages against its actual result count', () => {
    const page = select({ categoryId: 'solar', page: 2, pageSize: 1 });
    expect(page).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(page.items.map((record) => record.id)).toEqual(['product-2']);
    expect(select({ categoryId: 'solar', page: 3, pageSize: 1 })).toMatchObject({
      total: 2,
      page: 2,
    });
    expect(select({ collection: 'offers' }).items).toEqual([]);
    expect(select({ categoryId: 'missing', page: 99 })).toMatchObject({
      total: 0,
      page: 1,
      items: [],
    });
  });

  it('intersects category, brand, price and availability before pagination', () => {
    const one = product(1, 'panels');
    const two = product(2, 'mono', { brandId: 'brand-2' });
    two.variants[0].price = 20000;
    two.variants[0].stock = 0;
    const three = product(3, 'cables');
    const records = [one, two, three];
    const page = select(
      {
        categoryId: 'solar',
        brandIds: ['brand-1'],
        minimumPrice: 9000,
        maximumPrice: 11000,
        availability: 'in_stock',
        pageSize: 1,
      },
      records,
    );
    expect(page.total).toBe(1);
    expect(page.items.map((record) => record.id)).toEqual(['product-1']);
    expect(
      select({ brandIds: ['brand-2'], availability: 'out_of_stock' }, records).items.map(
        (record) => record.id,
      ),
    ).toEqual(['product-2']);
    expect(select({ brandIds: ['brand-2'], availability: 'in_stock' }, records).total).toBe(0);
  });

  it('uses minimum current SKU price, including discounted and out-of-stock SKUs', () => {
    const record = product(1, 'panels');
    record.variants[0].price = 15000;
    record.variants[0].compareAtPrice = 20000;
    record.variants.push({
      ...record.variants[0],
      id: 'cheap-sku',
      sku: 'CHEAP',
      price: 9000,
      stock: 0,
    });
    expect(select({ maximumPrice: 10000, availability: 'in_stock' }, [record]).total).toBe(1);
    expect(select({ minimumPrice: 10000 }, [record]).total).toBe(0);
    record.variants[0].stock = 0;
    expect(select({ availability: 'out_of_stock' }, [record]).total).toBe(1);
  });

  it.each(['price-asc', 'price-desc', 'newest', 'popularity', 'rating'] as const)(
    'uses stable IDs to resolve %s ties',
    (sort) => {
      const records = [product(2, 'panels'), product(1, 'panels')];
      expect(select({ sort }, records).items.map((record) => record.id)).toEqual([
        'product-1',
        'product-2',
      ]);
      expect(records[0].id).toBe('product-2');
    },
  );

  it('sorts selling price, creation date, popularity and rating in their selected directions', () => {
    const older = product(1, 'panels', { popularity: 1, rating: 3 });
    older.variants[0].price = 5000;
    older.variants[0].compareAtPrice = 30000;
    const newer = product(2, 'panels', {
      createdAt: '2026-02-01T00:00:00Z',
      popularity: 10,
      rating: 5,
    });
    newer.variants[0].price = 10000;
    const records = [newer, older];
    expect(select({ sort: 'price-asc' }, records).items.map((record) => record.id)).toEqual([
      'product-1',
      'product-2',
    ]);
    for (const sort of ['price-desc', 'newest', 'popularity', 'rating']) {
      expect(select({ sort }, records).items.map((record) => record.id)).toEqual([
        'product-2',
        'product-1',
      ]);
    }
    expect(
      select({ collection: 'featured', sort: 'price-asc' }, records).items.map(
        (record) => record.id,
      ),
    ).toEqual(['product-1', 'product-2']);
  });

  it('matches every trimmed search token case-insensitively across names and specifications', () => {
    const records = [
      product(1, 'panels', {
        name: 'Solar panel',
        specifications: [{ label: 'Power', value: '550W' }],
      }),
      product(2, 'panels', {
        name: 'Solar panel',
        specifications: [{ label: 'Power', value: '450W' }],
      }),
    ];
    expect(select({ text: '  sOLar   550w  ' }, records).items.map((record) => record.id)).toEqual([
      'product-1',
    ]);
    expect(select({ text: 'solar absent-token' }, records).items).toEqual([]);
  });

  it('finds SKU identifiers without requiring them in product titles', () => {
    expect(select({ text: '  sku-2 ' }).items.map((record) => record.id)).toEqual(['product-2']);
  });

  it('normalizes compatibility characters and preserves Unicode search text', () => {
    const records = [product(1, 'panels', { name: 'Solar PANEL', description: 'সোলার প্যানেল' })];
    expect(select({ text: 'ＰＡＮＥＬ' }, records).total).toBe(1);
    expect(select({ text: 'সোলার' }, records).total).toBe(1);
  });

  it('retains all records for blank search and gives an actionable empty result shape', () => {
    expect(select({ text: ' \t\n ' }).total).toBe(products.length);
    expect(select({ text: 'not-in-the-catalogue', page: 12 })).toMatchObject({
      total: 0,
      page: 1,
      items: [],
    });
  });

  it('intersects search with category, brand, availability and price filters', () => {
    const records = [
      product(1, 'panels', { name: 'Solar cable' }),
      product(2, 'panels', { name: 'Solar cable', brandId: 'brand-2' }),
      product(3, 'cables', { name: 'Solar cable' }),
    ];
    expect(
      select(
        {
          text: 'solar',
          categoryId: 'solar',
          brandIds: ['brand-1'],
          availability: 'in_stock',
          minimumPrice: 9000,
          maximumPrice: 11000,
        },
        records,
      ).items.map((record) => record.id),
    ).toEqual(['product-1']);
  });
});

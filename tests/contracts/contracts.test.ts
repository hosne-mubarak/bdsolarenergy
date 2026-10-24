import { describe, expect, it, vi } from 'vitest';
import { productQuerySchema } from '../../src/schemas';
import { createRepositoryContainer } from '../../src/services/container';
import type { CatalogueRepository, ReadOptions, Runtime } from '../../src/services/contracts';
import {
  normalizeRepositoryError,
  RepositoryError,
  throwIfAborted,
} from '../../src/services/errors';

function fakeCatalogue(): CatalogueRepository {
  const missing = async (_id: string, options?: ReadOptions): Promise<never> => {
    throwIfAborted(options?.signal);
    throw new RepositoryError('not_found');
  };
  return {
    listProducts: async (query, options) => {
      throwIfAborted(options?.signal);
      return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    },
    getProduct: missing,
    getProductById: missing,
    getVariant: missing,
    listCategories: async () => [],
    listBrands: async () => [],
    listImages: async () => [],
    getReviews: async () => [],
  };
}

describe('repository adapter boundary', () => {
  it('substitutes a typed catalogue adapter through the composition factory', async () => {
    const catalogue = fakeCatalogue();
    const container = createRepositoryContainer(undefined, () => ({ catalogue }));
    const page = await container.catalogue.listProducts(
      productQuerySchema.parse({ page: 2, pageSize: 8 }),
    );
    expect(page).toEqual({ items: [], total: 0, page: 2, pageSize: 8 });
    await expect(container.catalogue.getProduct('missing')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('rejects unsupported modes before invoking a JSON fallback', () => {
    const factory = vi.fn(fakeCatalogue);
    for (const mode of ['api', '', 'JSON', 'https://example.test']) {
      expect(() => createRepositoryContainer(mode, factory)).toThrow('Unsupported data source');
    }
    expect(factory).not.toHaveBeenCalled();
    expect(createRepositoryContainer('json', factory)).toBeDefined();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('preserves read cancellation as AbortError rather than retryable failure', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fakeCatalogue().listProducts(productQuerySchema.parse({}), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const error = new DOMException('Cancelled', 'AbortError');
    expect(() => normalizeRepositoryError(error)).toThrow(error);
  });

  it('normalizes unknown failures without exposing raw exception details', () => {
    const normalized = normalizeRepositoryError(new Error('private credential and transport body'));
    expect(normalized.code).toBe('unavailable');
    expect(normalized.message).not.toContain('credential');
    const validation = new RepositoryError('validation', 'Check the fields.', {
      email: ['Invalid address'],
    });
    expect(normalizeRepositoryError(validation)).toBe(validation);
    expect(validation.fieldErrors?.email).toEqual(['Invalid address']);
  });

  it('supports injected deterministic clocks and identifiers without global changes', () => {
    let counter = 0;
    const runtime: Runtime = {
      now: () => new Date('2026-10-24T00:00:00Z'),
      id: (prefix = 'test') => `${prefix}-${++counter}`,
    };
    const repository = createRepositoryContainer('json', () => ({
      timestamp: runtime.now().toISOString(),
      reference: runtime.id('order'),
    }));
    expect(repository).toEqual({ timestamp: '2026-10-24T00:00:00.000Z', reference: 'order-1' });
    expect(runtime.id('order')).toBe('order-2');
  });
});

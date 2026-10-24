import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Runtime } from '../contracts';
import { createPersistence, MemoryStorage } from './store';

const schema = z.object({ count: z.number().int().nonnegative() });
const now = '2026-10-24T00:00:00.000Z';
const runtime: Runtime = { now: () => new Date(now), id: (prefix = 'test') => `${prefix}-1` };
const seed = () => ({ count: 0 });
const envelope = (data: unknown, version = 1) => JSON.stringify({ version, updatedAt: now, data });

describe('versioned browser persistence', () => {
  it('seeds missing data and restores a validated namespaced envelope', () => {
    const storage = new MemoryStorage();
    const store = createPersistence(storage, runtime);
    expect(store.read('cart', schema, seed)).toEqual({ count: 0 });
    expect(store.write('cart', schema, { count: 2 })).toEqual({ count: 2 });
    expect(JSON.parse(storage.getItem('bdsolarenergy:cart')!)).toEqual({
      version: 1,
      updatedAt: now,
      data: { count: 2 },
    });
    const restored = createPersistence(storage, runtime);
    expect(restored.read('cart', schema, seed)).toEqual({ count: 2 });
  });

  it.each(['not-json', envelope({ count: 'invalid' })])(
    'recovers only a corrupt aggregate: %s',
    (raw) => {
      const storage = new MemoryStorage();
      storage.setItem('bdsolarenergy:cart', raw);
      storage.setItem('bdsolarenergy:wishlist', envelope({ count: 7 }));
      storage.setItem('another-app', 'untouched');
      const store = createPersistence(storage, runtime);
      expect(store.read('cart', schema, seed)).toEqual(seed());
      expect(store.read('wishlist', schema, seed)).toEqual({ count: 7 });
      expect(storage.getItem('another-app')).toBe('untouched');
      expect(store.notices().length).toBeGreaterThan(0);
    },
  );

  it('migrates a known older version and persists the validated refreshed envelope', () => {
    const storage = new MemoryStorage();
    storage.setItem('bdsolarenergy:cart', envelope({ items: 3 }));
    const store = createPersistence(storage, runtime);
    const value = store.read('cart', schema, seed, {
      version: 2,
      migrations: { 1: (data) => ({ count: (data as { items: number }).items }) },
    });
    expect(value).toEqual({ count: 3 });
    expect(JSON.parse(storage.getItem('bdsolarenergy:cart')!)).toEqual({
      version: 2,
      updatedAt: now,
      data: { count: 3 },
    });
  });

  it('resets a known old aggregate with no migration while preserving its neighbors', () => {
    const storage = new MemoryStorage();
    storage.setItem('bdsolarenergy:cart', envelope({ count: 2 }));
    storage.setItem('bdsolarenergy:other', envelope({ count: 9 }));
    const store = createPersistence(storage, runtime);
    expect(store.read('cart', schema, seed, { version: 2 })).toEqual(seed());
    expect(store.read('other', schema, seed)).toEqual({ count: 9 });
    expect(store.notices().length).toBeGreaterThan(0);
  });

  it('preserves unknown future data and asks for explicit recovery', () => {
    const storage = new MemoryStorage();
    const raw = envelope({ count: 12 }, 99);
    storage.setItem('bdsolarenergy:cart', raw);
    const store = createPersistence(storage, runtime);
    expect(() => store.read('cart', schema, seed)).toThrow(
      expect.objectContaining({ code: 'conflict' }),
    );
    expect(storage.getItem('bdsolarenergy:cart')).toBe(raw);
  });

  it('does not report success or replace existing state when storage quota is exhausted', () => {
    const storage = new MemoryStorage();
    const raw = envelope({ count: 1 });
    storage.setItem('bdsolarenergy:cart', raw);
    storage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const store = createPersistence(storage, runtime);
    expect(() => store.write('cart', schema, { count: 2 })).toThrow(
      expect.objectContaining({ code: 'storage_unavailable' }),
    );
    expect(storage.getItem('bdsolarenergy:cart')).toBe(raw);
  });

  it('surfaces denied reads instead of silently pretending empty data is valid', () => {
    const storage = new MemoryStorage();
    storage.getItem = vi.fn(() => {
      throw new DOMException('Storage denied', 'SecurityError');
    });
    const store = createPersistence(storage, runtime);
    expect(() => store.read('cart', schema, seed)).toThrow(
      expect.objectContaining({ code: 'storage_unavailable' }),
    );
  });

  it('rejects invalid writes before touching storage', () => {
    const storage = new MemoryStorage();
    const set = vi.spyOn(storage, 'setItem');
    const store = createPersistence(storage, runtime);
    expect(() => store.write('cart', schema, { count: -1 })).toThrow(
      expect.objectContaining({ code: 'validation' }),
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('resets only application keys and notifies successful mutations until unsubscribed', () => {
    const storage = new MemoryStorage();
    storage.setItem('another-app', 'untouched');
    const store = createPersistence(storage, runtime);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.write('cart', schema, { count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.write('wishlist', schema, { count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    store.reset();
    expect(storage.getItem('bdsolarenergy:cart')).toBeNull();
    expect(storage.getItem('bdsolarenergy:wishlist')).toBeNull();
    expect(storage.getItem('another-app')).toBe('untouched');
  });
  it('preserves the old envelope if persisting a migrated payload fails', () => {
    const storage = new MemoryStorage();
    const raw = envelope({ count: 3 });
    storage.setItem('bdsolarenergy:cart', raw);
    storage.setItem = () => {
      throw new Error('quota');
    };
    const store = createPersistence(storage, runtime);
    expect(() =>
      store.read('cart', schema, seed, { version: 2, migrations: { 1: (data) => data } }),
    ).toThrow(expect.objectContaining({ code: 'storage_unavailable' }));
    expect(storage.getItem('bdsolarenergy:cart')).toBe(raw);
    expect(store.notices()).toEqual([]);
  });

  it('reports a partially failed reset rather than claiming success', () => {
    const storage = new MemoryStorage();
    storage.setItem('bdsolarenergy:a', envelope({ count: 1 }));
    storage.setItem('bdsolarenergy:b', envelope({ count: 2 }));
    storage.setItem('other-app', 'keep');
    const remove = storage.removeItem.bind(storage);
    storage.removeItem = (key) => {
      if (key.endsWith(':b')) throw new Error('denied');
      remove(key);
    };
    const store = createPersistence(storage, runtime);
    expect(() => store.reset()).toThrow(expect.objectContaining({ code: 'storage_unavailable' }));
    expect(storage.getItem('other-app')).toBe('keep');
    expect(storage.getItem('bdsolarenergy:b')).not.toBeNull();
  });
});

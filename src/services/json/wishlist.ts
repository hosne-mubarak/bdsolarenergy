import { z } from 'zod';
import { wishlistSchema } from '../../schemas';
import type { Wishlist } from '../../types';
import type { WishlistRepository } from '../contracts';
import type { CartDependencies } from './cart';
import { normalizeRepositoryError, RepositoryError, throwIfAborted } from '../errors';
const aggregateSchema = z.object({
  revision: z.number().int().nonnegative(),
  byOwner: z.record(wishlistSchema),
});

export function createJsonWishlistRepository({
  catalogue,
  store,
  runtime,
  getOwner,
}: CartDependencies): WishlistRepository {
  const empty = (ownerKey: string): Wishlist => ({
    ownerKey,
    productIds: [],
    updatedAt: runtime.now().toISOString(),
  });
  const read = () =>
    store.read<z.infer<typeof aggregateSchema>>('wishlists', aggregateSchema, () => ({
      revision: 0,
      byOwner: {},
    }));
  function commit(state: z.infer<typeof aggregateSchema>, revision: number) {
    if (read().revision !== revision)
      throw new RepositoryError('conflict', 'Your wishlist changed. Please retry.');
    store.write('wishlists', aggregateSchema, { ...state, revision: revision + 1 });
  }
  async function operation<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeRepositoryError(error);
    }
  }
  async function exists(id: string) {
    try {
      await catalogue.getProductById(id);
      return true;
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'not_found') return false;
      throw error;
    }
  }
  return {
    list: (options) =>
      operation(async () => {
        throwIfAborted(options?.signal);
        const owner = await getOwner();
        throwIfAborted(options?.signal);
        const state = read();
        const current = state.byOwner[owner] ?? empty(owner);
        const ids: string[] = [];
        for (const id of current.productIds) {
          if (await exists(id)) ids.push(id);
          throwIfAborted(options?.signal);
        }
        if (ids.length !== current.productIds.length) {
          state.byOwner[owner] = {
            ...current,
            productIds: ids,
            updatedAt: runtime.now().toISOString(),
          };
          commit(state, state.revision);
          store.reportNotice(
            'Your wishlist was updated because a product is no longer in the catalogue.',
          );
          return state.byOwner[owner];
        }
        return current;
      }),
    toggle: (id) =>
      operation(async () => {
        const owner = await getOwner();
        const valid = await exists(id);
        const state = read();
        const current = state.byOwner[owner] ?? empty(owner);
        const selected = current.productIds.includes(id);
        if (!selected && !valid) throw new RepositoryError('not_found');
        const value = {
          ownerKey: owner,
          productIds: selected
            ? current.productIds.filter((key) => key !== id)
            : [...current.productIds, id],
          updatedAt: runtime.now().toISOString(),
        };
        state.byOwner[owner] = value;
        commit(state, state.revision);
        return value;
      }),
    mergeGuestWishlist: () =>
      operation(async () => {
        const owner = await getOwner();
        if (owner === 'guest') throw new RepositoryError('unauthenticated');
        const state = read();
        const target = state.byOwner[owner] ?? empty(owner);
        const guest = state.byOwner.guest;
        if (!guest?.productIds.length) return target;
        const ids = [...new Set([...target.productIds, ...guest.productIds])];
        const valid: string[] = [];
        for (const id of ids) if (await exists(id)) valid.push(id);
        const value = {
          ownerKey: owner,
          productIds: valid,
          updatedAt: runtime.now().toISOString(),
        };
        state.byOwner[owner] = value;
        state.byOwner.guest = empty('guest');
        commit(state, state.revision);
        return value;
      }),
  };
}

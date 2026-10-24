import type { Cart, CartLine, Variant } from '../../types';
import type { CartRepository, CatalogueRepository, Runtime } from '../contracts';
import { normalizeRepositoryError, RepositoryError, throwIfAborted } from '../errors';
import type { Persistence } from '../persistence/store';
import { validateQuantity } from '../../domain/cart/rules';
import { readCheckout, commitCheckout } from './checkout-state';

export interface CartDependencies {
  catalogue: CatalogueRepository;
  store: Persistence;
  runtime: Runtime;
  getOwner(): Promise<string>;
}
export function createJsonCartRepository({
  catalogue,
  store,
  runtime,
  getOwner,
}: CartDependencies): CartRepository {
  function empty(ownerKey: string): Cart {
    return { ownerKey, lines: [], updatedAt: runtime.now().toISOString() };
  }
  async function operation<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw normalizeRepositoryError(error);
    }
  }
  async function variantOrMissing(id: string): Promise<Variant | null> {
    try {
      return (await catalogue.getVariant(id)).variant;
    } catch (error) {
      if (error instanceof RepositoryError && error.code === 'not_found') return null;
      throw error;
    }
  }
  async function edit(variantId: string, quantity: number, add: boolean) {
    const owner = await getOwner();
    const { variant } = await catalogue.getVariant(variantId);
    const state = readCheckout(store);
    const revision = state.revision;
    const cart = state.carts[owner] ?? empty(owner);
    const current = cart.lines.find((line) => line.variantId === variantId)?.quantity ?? 0;
    const next = add ? current + quantity : quantity;
    if (add && (!Number.isSafeInteger(quantity) || quantity < 1))
      throw new RepositoryError('validation', 'Quantity must be a positive whole number.');
    validateQuantity(next, variant, state.reservations[variantId] ?? 0);
    const lines = cart.lines.filter((line) => line.variantId !== variantId);
    lines.push({ variantId, quantity: next });
    const updated = { ...cart, ownerKey: owner, lines, updatedAt: runtime.now().toISOString() };
    state.carts[owner] = updated;
    commitCheckout(store, state, revision);
    return updated;
  }
  const repository: CartRepository = {
    getCart: (options) =>
      operation(async () => {
        throwIfAborted(options?.signal);
        const owner = await getOwner();
        const state = readCheckout(store);
        const revision = state.revision;
        const cart = state.carts[owner] ?? empty(owner);
        const lines: CartLine[] = [];
        let repaired = cart.ownerKey !== owner;
        for (const line of cart.lines) {
          const variant = await variantOrMissing(line.variantId);
          throwIfAborted(options?.signal);
          const available = variant
            ? Math.max(
                0,
                Math.min(
                  variant.maxPerOrder,
                  variant.stock - (state.reservations[variant.id] ?? 0),
                ),
              )
            : 0;
          const quantity = Math.min(line.quantity, available);
          if (quantity !== line.quantity) repaired = true;
          if (quantity > 0) lines.push({ ...line, quantity });
        }
        throwIfAborted(options?.signal);
        if (repaired) {
          const updated = { ownerKey: owner, lines, updatedAt: runtime.now().toISOString() };
          state.carts[owner] = updated;
          commitCheckout(store, state, revision);
          store.reportNotice(
            'Your cart was updated because some product options or quantities are no longer available.',
          );
          return updated;
        }
        return cart;
      }),
    add: (id, quantity) => operation(() => edit(id, quantity, true)),
    setQuantity: (id, quantity) =>
      quantity === 0 ? repository.removeLine(id) : operation(() => edit(id, quantity, false)),
    removeLine: (id) =>
      operation(async () => {
        const owner = await getOwner();
        const state = readCheckout(store);
        const revision = state.revision;
        const cart = state.carts[owner] ?? empty(owner);
        const updated = {
          ...cart,
          lines: cart.lines.filter((line) => line.variantId !== id),
          updatedAt: runtime.now().toISOString(),
        };
        state.carts[owner] = updated;
        commitCheckout(store, state, revision);
        return updated;
      }),
    clear: () =>
      operation(async () => {
        const owner = await getOwner();
        const state = readCheckout(store);
        const updated = empty(owner);
        state.carts[owner] = updated;
        commitCheckout(store, state, state.revision);
        return updated;
      }),
    mergeGuestCart: () =>
      operation(async () => {
        const owner = await getOwner();
        if (owner === 'guest') throw new RepositoryError('unauthenticated');
        // Resolve catalogue before the final state read to avoid losing a concurrent in-tab mutation.
        const initial = readCheckout(store);
        const ids = new Set(
          [...(initial.carts.guest?.lines ?? []), ...(initial.carts[owner]?.lines ?? [])].map(
            (line) => line.variantId,
          ),
        );
        const variants = new Map<string, Variant | null>();
        for (const id of ids) variants.set(id, await variantOrMissing(id));
        const state = readCheckout(store);
        const revision = state.revision;
        const target = state.carts[owner] ?? empty(owner);
        const guest = state.carts.guest;
        if (!guest?.lines.length) return { cart: target, notices: [] };
        const combined = new Map<string, bigint>();
        for (const line of [...target.lines, ...guest.lines])
          combined.set(
            line.variantId,
            (combined.get(line.variantId) ?? 0n) + BigInt(line.quantity),
          );
        const notices: string[] = [];
        const lines: CartLine[] = [];
        for (const [variantId, requested] of combined) {
          const variant = variants.get(variantId);
          if (variant === undefined)
            throw new RepositoryError(
              'conflict',
              'Your cart changed during sign-in. Please retry the merge.',
            );
          const cap = variant
            ? Math.max(
                0,
                Math.min(variant.maxPerOrder, variant.stock - (state.reservations[variantId] ?? 0)),
              )
            : 0;
          const quantity = Number(requested > BigInt(cap) ? BigInt(cap) : requested);
          if (BigInt(quantity) !== requested)
            notices.push('A saved quantity was reduced to current stock and order limits.');
          if (quantity) lines.push({ variantId, quantity });
        }
        const cart = { ownerKey: owner, lines, updatedAt: runtime.now().toISOString() };
        state.carts[owner] = cart;
        state.carts.guest = empty('guest');
        commitCheckout(store, state, revision);
        return { cart, notices };
      }),
  };
  return repository;
}

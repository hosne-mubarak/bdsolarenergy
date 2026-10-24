import { z } from 'zod';
import {
  addressInputSchema,
  checkoutInputSchema,
  idSchema,
  orderSchema,
  quoteSchema,
} from '../../schemas';
import type { CheckoutInput, Order, Quote } from '../../types';
import { calculateCart } from '../../domain/cart/rules';
import { calculateTotals, findCoupon } from '../../domain/checkout/rules';
import type {
  AuthRepository,
  CatalogueRepository,
  ContentRepository,
  OrderRepository,
  ReadOptions,
  Runtime,
} from '../contracts';
import { requireSession } from '../current-user';
import { normalizeRepositoryError, RepositoryError, throwIfAborted } from '../errors';
import type { Persistence } from '../persistence/store';
import { validateInput } from '../validation';
import { commitCheckout, readCheckout } from './checkout-state';

export interface OrderDependencies {
  auth: Pick<AuthRepository, 'getSession'>;
  catalogue: CatalogueRepository;
  content: ContentRepository;
  store: Persistence;
  runtime: Runtime;
}
export const quotesByOwnerSchema = z.record(quoteSchema);
export function readQuotes(store: Persistence): Record<string, Quote> {
  return store.read('quotes', quotesByOwnerSchema, () => ({}));
}
const strictCheckoutInputSchema = checkoutInputSchema
  .extend({ address: addressInputSchema.strict() })
  .strict();

/** Obtain authoritative current prices/configuration and reject concurrent cart changes. */
export async function prepareCheckout(
  dependencies: OrderDependencies,
  input: CheckoutInput,
  options?: ReadOptions,
) {
  const { auth, catalogue, content, store, runtime } = dependencies;
  const session = await requireSession(auth, options);
  const parsed = validateInput(strictCheckoutInputSchema, input);
  const initial = readCheckout(store);
  const cart = initial.carts[session.userId];
  if (!cart?.lines.length)
    throw new RepositoryError('validation', 'Add products to your cart before checking out.');
  if (cart.ownerKey !== session.userId) throw new RepositoryError('conflict');
  const [variants, configuration] = await Promise.all([
    Promise.all(cart.lines.map((line) => catalogue.getVariant(line.variantId, options))),
    content.getCheckoutConfiguration(options),
  ]);
  const confirmed = await requireSession(auth, options);
  if (confirmed.userId !== session.userId)
    throw new RepositoryError('conflict', 'Your session changed. Please review checkout again.');
  const state = readCheckout(store);
  if (state.revision !== initial.revision)
    throw new RepositoryError('conflict', 'Your cart changed. Please review checkout again.');
  const products = [...new Map(variants.map(({ product }) => [product.id, product])).values()];
  const shipping = configuration.shipping.find((method) => method.id === parsed.shippingMethodId);
  const payment = configuration.payments.find((method) => method.id === parsed.paymentMethodId);
  if (!shipping) throw new RepositoryError('validation', 'Choose an available delivery method.');
  if (!payment?.enabled || !payment.demoOnly)
    throw new RepositoryError('validation', 'Choose an available demo payment method.');
  const { items } = calculateCart(cart.lines, products, state.reservations);
  const coupon = findCoupon(configuration.coupons, parsed.couponCode);
  const totals = calculateTotals({
    items,
    products,
    coupon,
    shipping,
    district: parsed.address.district,
    minimumOrder: configuration.minimumOrder,
    now: runtime.now(),
  });
  throwIfAborted(options?.signal);
  return { session, state, input: parsed, items, totals };
}

export function createJsonOrderRepository(dependencies: OrderDependencies): OrderRepository {
  const { store, runtime } = dependencies;
  async function existingOrder(owner: string, key: string): Promise<Order | undefined> {
    const session = await requireSession(dependencies.auth);
    if (session.userId !== owner)
      throw new RepositoryError('conflict', 'Your session changed. Please review checkout again.');
    return readCheckout(store).orders.find(
      (order) => order.userId === owner && order.idempotencyKey === key,
    );
  }
  const repository: OrderRepository = {
    async listOrders(query = {}, options) {
      try {
        const session = await requireSession(dependencies.auth, options);
        const parsed = validateInput(
          z
            .object({
              page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
              pageSize: z.number().int().min(1).max(50).default(10),
            })
            .strict(),
          query,
        );
        const owned = readCheckout(store)
          .orders.filter((order) => order.userId === session.userId)
          .sort(
            (a, b) =>
              Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
              (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
          );
        throwIfAborted(options?.signal);
        const total = owned.length;
        const page = Math.min(parsed.page, Math.max(1, Math.ceil(total / parsed.pageSize)));
        const start = (page - 1) * parsed.pageSize;
        return structuredClone({
          items: owned.slice(start, start + parsed.pageSize),
          total,
          page,
          pageSize: parsed.pageSize,
        });
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    },
    async getTracking(id, options) {
      const order = await repository.getOrder(id, options);
      throwIfAborted(options?.signal);
      return structuredClone(order.tracking);
    },
    async getOrder(id, options) {
      try {
        const session = await requireSession(dependencies.auth, options);
        const state = readCheckout(store);
        const order = state.orders.find(
          (record) => record.id === id && record.userId === session.userId,
        );
        throwIfAborted(options?.signal);
        if (!order) throw new RepositoryError('not_found', 'This order could not be found.');
        return structuredClone(order);
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    },
    async placeOrder(input, idempotencyKey) {
      try {
        const key = validateInput(idSchema, idempotencyKey);
        const session = await requireSession(dependencies.auth);
        // A successful retry must work after cart clearing, quote expiry, or later catalogue changes.
        const existing = await existingOrder(session.userId, key);
        if (existing) return structuredClone(existing);
        try {
          const prepared = await prepareCheckout(dependencies, input);
          if (prepared.session.userId !== session.userId)
            throw new RepositoryError(
              'conflict',
              'Your session changed. Please review checkout again.',
            );
          const state = readCheckout(store);
          const duplicate = state.orders.find(
            (order) => order.userId === session.userId && order.idempotencyKey === key,
          );
          if (duplicate) return structuredClone(duplicate);
          if (state.revision !== prepared.state.revision)
            throw new RepositoryError(
              'conflict',
              'Your cart changed. Please review checkout again.',
            );
          const records = readQuotes(store);
          const reviewed = Object.hasOwn(records, session.userId)
            ? records[session.userId]
            : undefined;
          if (
            !reviewed ||
            reviewed.ownerKey !== session.userId ||
            reviewed.id !== prepared.input.expectedQuoteId ||
            Date.parse(reviewed.expiresAt) <= runtime.now().getTime()
          )
            throw new RepositoryError(
              'conflict',
              'Your checkout review has expired or changed. Review the totals again.',
            );
          const currentInput = { ...prepared.input };
          delete currentInput.expectedQuoteId;
          if (
            JSON.stringify(reviewed.items) !== JSON.stringify(prepared.items) ||
            JSON.stringify(reviewed.totals) !== JSON.stringify(prepared.totals) ||
            JSON.stringify(reviewed.input) !== JSON.stringify(currentInput)
          )
            throw new RepositoryError(
              'conflict',
              'Prices, delivery or checkout details have changed. Review the totals again.',
            );
          const createdAt = runtime.now().toISOString();
          const order = validateInput(orderSchema, {
            id: runtime.id('order'),
            userId: session.userId,
            idempotencyKey: key,
            status: 'placed',
            items: prepared.items,
            address: {
              ...currentInput.address,
              id: runtime.id('delivery-address'),
              userId: session.userId,
            },
            totals: prepared.totals,
            shippingMethodId: currentInput.shippingMethodId,
            paymentMethodId: currentInput.paymentMethodId,
            couponCode: currentInput.couponCode || null,
            createdAt,
            tracking: [
              {
                status: 'placed',
                label: 'Demo order recorded locally; no shipment has been booked.',
                at: createdAt,
              },
            ],
            demoOnly: true,
          });
          if (state.orders.some((record) => record.id === order.id))
            throw new RepositoryError(
              'conflict',
              'The order identifier is already in use. Please retry.',
            );
          const reservations = { ...state.reservations };
          for (const item of order.items)
            reservations[item.variantId] = (reservations[item.variantId] ?? 0) + item.quantity;
          // One write commits order snapshots, current-browser reservations, and cart clearing together.
          commitCheckout(
            store,
            {
              ...state,
              orders: [...state.orders, order],
              reservations,
              carts: {
                ...state.carts,
                [session.userId]: { ownerKey: session.userId, lines: [], updatedAt: createdAt },
              },
            },
            state.revision,
          );
          return structuredClone(order);
        } catch (error) {
          // Parallel duplicate submissions can observe the winner's cart/revision change during preparation.
          const duplicate = await existingOrder(session.userId, key);
          if (duplicate) return structuredClone(duplicate);
          throw error;
        }
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    },
    async quote(input, options) {
      try {
        const prepared = await prepareCheckout(dependencies, input, options);
        const reviewedInput = { ...prepared.input };
        delete reviewedInput.expectedQuoteId;
        // A quote is an expiring review snapshot, never a stock reservation or placed order.
        const quote = validateInput(quoteSchema, {
          id: runtime.id('quote'),
          ownerKey: prepared.session.userId,
          items: prepared.items,
          totals: prepared.totals,
          input: reviewedInput,
          expiresAt: new Date(runtime.now().getTime() + 10 * 60_000).toISOString(),
        });
        const records = readQuotes(store);
        if (Object.values(records).some((record) => record.id === quote.id))
          throw new RepositoryError(
            'conflict',
            'The review identifier is already in use. Please retry.',
          );
        throwIfAborted(options?.signal);
        store.write('quotes', quotesByOwnerSchema, {
          ...records,
          [quote.ownerKey]: quote,
        });
        return structuredClone(quote);
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    },
  };
  return repository;
}

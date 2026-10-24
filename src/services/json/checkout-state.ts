import { checkoutAggregateSchema } from '../../schemas';
import type { CheckoutAggregate } from '../../types';
import type { Persistence } from '../persistence/store';
import { RepositoryError } from '../errors';

export function readCheckout(store: Persistence): CheckoutAggregate {
  return store.read('checkout', checkoutAggregateSchema, () => ({
    revision: 0,
    carts: {},
    orders: [],
    reservations: {},
  }));
}
export function commitCheckout(
  store: Persistence,
  state: CheckoutAggregate,
  expectedRevision: number,
) {
  if (readCheckout(store).revision !== expectedRevision)
    throw new RepositoryError(
      'conflict',
      'Shopping data changed in another action. Please reload and review.',
    );
  return store.write('checkout', checkoutAggregateSchema, {
    ...state,
    revision: expectedRevision + 1,
  });
}

import type { PublicRepositories } from './public';
import type { Runtime } from './contracts';
import { browserRuntime } from './runtime';
import { browserStorage } from './persistence/browser';
import { createPersistence, type Persistence } from './persistence/store';
import { createJsonCustomerRepository } from './json/customers';
import { createJsonAuthRepository } from './json/auth';
import { createJsonWishlistRepository } from './json/wishlist';
import { createJsonCartRepository } from './json/cart';
import { createJsonOrderRepository } from './json/orders';
import { createJsonCheckoutAttemptRepository } from './json/checkout-attempts';

export function createShoppingServices(
  repositories: PublicRepositories,
  options: {
    runtime?: Runtime;
    store?: Persistence;
    sessionStore?: Persistence;
    getOwner?: () => Promise<string>;
  } = {},
) {
  const runtime = options.runtime ?? browserRuntime;
  const store = options.store ?? createPersistence(browserStorage(), runtime);
  const sessionStore =
    options.sessionStore ?? createPersistence(browserStorage('sessionStorage'), runtime);
  const auth = createJsonAuthRepository({ store, sessionStore, runtime });
  const getOwner = options.getOwner ?? (async () => (await auth.getSession())?.userId ?? 'guest');
  return {
    store,
    sessionStore,
    resetDemoData() {
      store.reset();
      sessionStore.reset();
    },
    auth,
    customers: createJsonCustomerRepository({ auth, store, runtime }),
    checkoutAttempts: createJsonCheckoutAttemptRepository({ auth, store, runtime }),
    orders: createJsonOrderRepository({
      auth,
      catalogue: repositories.catalogue,
      content: repositories.content,
      store,
      runtime,
    }),
    runtime,
    wishlist: createJsonWishlistRepository({
      catalogue: repositories.catalogue,
      store,
      runtime,
      getOwner,
    }),
    cart: createJsonCartRepository({ catalogue: repositories.catalogue, store, runtime, getOwner }),
  };
}
export type ShoppingServices = ReturnType<typeof createShoppingServices>;

import type { QueryClient } from '@tanstack/react-query';
import type { ShoppingServices } from '../../services/shopping';
import { normalizeRepositoryError, RepositoryError } from '../../services/errors';
import { refreshSessionQueries } from './refresh-session';

/** Each repository merge is atomic and repeatable; failed completion can safely be retried. */
export async function completeSignIn(services: ShoppingServices, client: QueryClient) {
  try {
    const result = await services.cart.mergeGuestCart();
    await services.wishlist.mergeGuestWishlist();
    result.notices.forEach((message) => services.store.reportNotice(message));
  } catch (error) {
    const failure = normalizeRepositoryError(error);
    // Keep a failed merge on the sign-in screen. Successfully moved items remain in the account.
    try {
      await services.auth.logout();
    } finally {
      await refreshSessionQueries(client);
    }
    throw new RepositoryError(
      failure.code,
      'Sign-in could not finish merging saved shopping data. Your items are preserved. Please sign in again to retry.',
    );
  }
  await refreshSessionQueries(client);
}

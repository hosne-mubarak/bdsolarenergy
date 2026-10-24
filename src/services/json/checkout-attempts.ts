import { z } from 'zod';
import { idSchema } from '../../schemas';
import type { AuthRepository, CheckoutAttemptRepository, Runtime } from '../contracts';
import { requireSession } from '../current-user';
import { normalizeRepositoryError, RepositoryError } from '../errors';
import type { Persistence } from '../persistence/store';
import { validateInput } from '../validation';
import { readQuotes } from './orders';

const attemptsSchema = z.record(z.record(idSchema));
export function createJsonCheckoutAttemptRepository({
  auth,
  store,
  runtime,
}: {
  auth: Pick<AuthRepository, 'getSession'>;
  store: Persistence;
  runtime: Runtime;
}): CheckoutAttemptRepository {
  return {
    async getOrCreate(quoteId) {
      try {
        const id = validateInput(idSchema, quoteId);
        const session = await requireSession(auth);
        const records = store.read<Record<string, Record<string, string>>>(
          'checkout-attempts',
          attemptsSchema,
          () => ({}),
        );
        const owned = Object.hasOwn(records, session.userId) ? records[session.userId] : {};
        // Existing keys survive an expired/superseded quote so a successful order can be recovered by retry.
        if (Object.hasOwn(owned, id)) return owned[id];
        const quotes = readQuotes(store);
        const quote = Object.hasOwn(quotes, session.userId) ? quotes[session.userId] : undefined;
        if (!quote || quote.id !== id || quote.ownerKey !== session.userId)
          throw new RepositoryError('conflict', 'Review checkout before preparing a submission.');
        const key = validateInput(idSchema, runtime.id('checkout-attempt'));
        if (Object.values(owned).includes(key))
          throw new RepositoryError(
            'conflict',
            'The submission identifier is already in use. Please retry.',
          );
        store.write('checkout-attempts', attemptsSchema, {
          ...records,
          [session.userId]: { ...owned, [id]: key },
        });
        return key;
      } catch (error) {
        throw normalizeRepositoryError(error);
      }
    },
  };
}

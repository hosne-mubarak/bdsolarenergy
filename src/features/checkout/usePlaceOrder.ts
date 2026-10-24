import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Quote } from '../../types';
import { useShoppingServices } from '../store/useShoppingServices';
import { RepositoryError } from '../../services/errors';
/** The repository persists the retry key; this ref also rejects synchronous double clicks. */
export function usePlaceOrder() {
  const { orders, checkoutAttempts } = useShoppingServices();
  const client = useQueryClient();
  const busy = useRef(false);
  const mutation = useMutation({
    mutationFn: async (quote: Quote) => {
      const key = await checkoutAttempts.getOrCreate(quote.id);
      return orders.placeOrder({ ...quote.input, expectedQuoteId: quote.id }, key);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
  return {
    ...mutation,
    submit: async (quote: Quote) => {
      if (busy.current)
        throw new RepositoryError('conflict', 'Order submission is already in progress.');
      busy.current = true;
      try {
        return await mutation.mutateAsync(quote);
      } finally {
        busy.current = false;
      }
    },
  };
}

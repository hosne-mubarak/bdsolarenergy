import { RepositoryError } from '../../services/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth, useOwnerKey } from '../auth/useAuth';
import { useShoppingServices } from '../store/useShoppingServices';
export { useShoppingServices } from '../store/useShoppingServices';

export function useCart() {
  const { cart } = useShoppingServices();
  const auth = useAuth();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['shopping', 'cart', owner],
    enabled: !auth.isPending,
    queryFn: async ({ signal }) => {
      const result = await cart.getCart({ signal });
      if (result.ownerKey !== owner)
        throw new RepositoryError('conflict', 'Your session changed. Please reload your cart.');
      return result;
    },
  });
}
export function useCartActions() {
  const { cart } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: 'add' | 'set' | 'remove' | 'clear';
      variantId?: string;
      quantity?: number;
    }) => {
      if (input.type === 'clear') return cart.clear();
      if (input.type === 'remove') return cart.removeLine(input.variantId!);
      if (input.type === 'set') return cart.setQuantity(input.variantId!, input.quantity!);
      return cart.add(input.variantId!, input.quantity!);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['shopping', 'cart'] }),
  });
}

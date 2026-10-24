import { useQuery } from '@tanstack/react-query';
import { useOwnerKey } from '../auth/useAuth';
import { useShoppingServices } from '../store/useShoppingServices';
import { RepositoryError } from '../../services/errors';
export function useOrder(id: string) {
  const owner = useOwnerKey();
  const { orders } = useShoppingServices();
  return useQuery({
    queryKey: ['shopping', 'order', owner, id],
    queryFn: async ({ signal }) => {
      const order = await orders.getOrder(id, { signal });
      if (order.userId !== owner)
        throw new RepositoryError('conflict', 'Your session changed. Reload this order.');
      return order;
    },
  });
}

export function useOrders(page = 1, pageSize = 5) {
  const owner = useOwnerKey();
  const { orders } = useShoppingServices();
  return useQuery({
    queryKey: ['shopping', 'orders', owner, page, pageSize],
    queryFn: async ({ signal }) => {
      const result = await orders.listOrders({ page, pageSize }, { signal });
      if (result.items.some((order) => order.userId !== owner))
        throw new RepositoryError('conflict', 'Your session changed. Reload your orders.');
      return result;
    },
  });
}
export function useTracking(id: string) {
  const owner = useOwnerKey();
  const { orders } = useShoppingServices();
  return useQuery({
    queryKey: ['shopping', 'tracking', owner, id],
    queryFn: ({ signal }) => orders.getTracking(id, { signal }),
  });
}

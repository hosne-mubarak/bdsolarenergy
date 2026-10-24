import { RepositoryError } from '../../services/errors';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useShoppingServices } from '../cart/useCart';
import { useAuth, useOwnerKey } from '../auth/useAuth';
import { useRepositories } from '../store/useStore';
export function useWishlist() {
  const { wishlist } = useShoppingServices();
  const auth = useAuth();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['shopping', 'wishlist', owner],
    enabled: !auth.isPending,
    queryFn: async ({ signal }) => {
      const result = await wishlist.list({ signal });
      if (result.ownerKey !== owner)
        throw new RepositoryError('conflict', 'Your session changed. Please reload your wishlist.');
      return result;
    },
  });
}
export function useWishlistToggle() {
  const { wishlist } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wishlist.toggle(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shopping', 'wishlist'] }),
  });
}
export function useWishlistData(ids: string[] | undefined) {
  const owner = useOwnerKey();
  const { catalogue } = useRepositories();
  return useQuery({
    queryKey: ['shopping', 'wishlist-products', owner, ids],
    enabled: ids !== undefined,
    queryFn: async ({ signal }) => {
      const [products, images] = await Promise.all([
        Promise.all((ids ?? []).map((id) => catalogue.getProductById(id, { signal }))),
        catalogue.listImages({ signal }),
      ]);
      return { products, images };
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RepositoryError } from '../../services/errors';
import type { ProfileInput } from '../../types';
import { useShoppingServices } from '../store/useShoppingServices';
import { useRepositories } from '../store/useStore';
import { useOwnerKey } from '../auth/useAuth';
export function useProfile() {
  const { customers } = useShoppingServices();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['shopping', 'profile', owner],
    queryFn: async ({ signal }) => {
      const user = await customers.getProfile({ signal });
      if (user.id !== owner)
        throw new RepositoryError('conflict', 'Your session changed. Please reload your profile.');
      return user;
    },
  });
}
export function useProfileUpdate() {
  const { customers } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) => customers.updateProfile(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shopping', 'profile'] }),
  });
}
export function useAccountNavigation() {
  const { content } = useRepositories();
  return useQuery({
    queryKey: ['content', 'account-navigation'],
    queryFn: ({ signal }) => content.getAccountNavigation({ signal }),
  });
}

export function useAddresses() {
  const { customers } = useShoppingServices();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['shopping', 'addresses', owner],
    queryFn: async ({ signal }) => {
      const addresses = await customers.listAddresses({ signal });
      if (addresses.some((address) => address.userId !== owner))
        throw new RepositoryError(
          'conflict',
          'Your session changed. Please reload your addresses.',
        );
      return addresses;
    },
  });
}
export function useAddress(id: string | undefined) {
  const { customers } = useShoppingServices();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['shopping', 'address', owner, id],
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const address = await customers.getAddress(id!, { signal });
      if (address.userId !== owner)
        throw new RepositoryError('conflict', 'Your session changed. Please reload your address.');
      return address;
    },
  });
}
export function useAddressSave() {
  const { customers } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: import('../../types').AddressInput; id?: string }) =>
      customers.saveAddress(input, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['shopping', 'addresses'] });
      await client.invalidateQueries({ queryKey: ['shopping', 'address'] });
    },
  });
}
export function useAddressDelete() {
  const { customers } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customers.deleteAddress(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shopping', 'addresses'] }),
  });
}

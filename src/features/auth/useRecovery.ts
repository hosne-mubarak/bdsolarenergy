import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangePasswordInput, ResetPasswordInput } from '../../types';
import { useShoppingServices } from '../store/useShoppingServices';
import { useAuth, useOwnerKey } from './useAuth';
import { refreshSessionQueries } from './refresh-session';
export function useResetRequest() {
  const { auth } = useShoppingServices();
  return useMutation({ mutationFn: (email: string) => auth.requestReset(email) });
}
export function useResetPassword() {
  const { auth } = useShoppingServices();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => auth.resetDemoPassword(input),
    onSuccess: () => refreshSessionQueries(client),
  });
}
export function useChangePassword() {
  const { auth } = useShoppingServices();
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => auth.changeDemoPassword(input),
  });
}
export function useVerification() {
  const { auth } = useShoppingServices();
  const session = useAuth();
  const owner = useOwnerKey();
  return useQuery({
    queryKey: ['auth', 'verification', owner],
    enabled: !session.isPending,
    queryFn: ({ signal }) => auth.getVerificationStatus({ signal }),
  });
}

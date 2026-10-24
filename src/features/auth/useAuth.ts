import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../../app/providers/auth-context';
import { useShoppingServices } from '../store/useShoppingServices';
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
export function useOwnerKey() {
  const auth = useAuth();
  return auth.data?.userId ?? 'guest';
}
export function useDemoAccess() {
  const { auth } = useShoppingServices();
  return useQuery({
    queryKey: ['auth', 'demo-access'],
    queryFn: ({ signal }) => auth.getDemoAccess({ signal }),
    staleTime: Infinity,
  });
}

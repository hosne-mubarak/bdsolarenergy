import { useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery, useIsMutating } from '@tanstack/react-query';
import { ShoppingContext } from './shopping-context';
import { createAuthTransition } from './auth-transition';
import { AuthContext } from './auth-context';
export function AuthProvider({ children }: { children: ReactNode }) {
  const services = useContext(ShoppingContext);
  if (!services) throw new Error('ShoppingProvider is required');
  const [transition] = useState(createAuthTransition);
  const fenced = useSyncExternalStore(
    transition.subscribe,
    transition.getSnapshot,
    transition.getSnapshot,
  );
  const isMutating = useIsMutating({ mutationKey: ['auth', 'transition'] }) > 0;
  const isTransitioning = fenced || isMutating;
  const session = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: ({ signal }) => services.auth.getSession({ signal }),
    staleTime: 0,
    refetchInterval: 30_000,
  });
  return (
    <AuthContext.Provider
      value={{
        ...session,
        isTransitioning,
        beginTransition: transition.begin,
        endTransition: transition.end,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

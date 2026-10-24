import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from './query-client';
import { ToastProvider } from './ToastProvider';
import { RepositoryProvider } from './RepositoryProvider';
import { AuthProvider } from './AuthProvider';
import { ShoppingProvider } from './ShoppingProvider';
import type { PublicRepositories } from '../../services/public';

export function AppProviders({
  children,
  client,
  repositories,
}: {
  children: ReactNode;
  client?: QueryClient;
  repositories?: PublicRepositories;
}) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RepositoryProvider repositories={repositories}>
          <ShoppingProvider>
            <AuthProvider>{children}</AuthProvider>
          </ShoppingProvider>
        </RepositoryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

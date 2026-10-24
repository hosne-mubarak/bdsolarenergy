import { useState, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createQueryClient } from './query-client';
import { ToastProvider } from './ToastProvider';
import { RepositoryProvider } from './RepositoryProvider';
import { AuthProvider } from './AuthProvider';
import { ShoppingProvider } from './ShoppingProvider';
import type { PublicRepositories } from '../../services/public';
import type { ShoppingServices } from '../../services/shopping';

export function AppProviders({
  children,
  client,
  repositories,
  services,
}: {
  children: ReactNode;
  client?: QueryClient;
  repositories?: PublicRepositories;
  services?: ShoppingServices;
}) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RepositoryProvider repositories={repositories}>
          <ShoppingProvider services={services}>
            <AuthProvider>{children}</AuthProvider>
          </ShoppingProvider>
        </RepositoryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

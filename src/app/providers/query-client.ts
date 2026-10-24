import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: (failureCount, error) => {
          const code = 'code' in error ? error.code : undefined;
          const transientRead = code === 'unavailable' || error instanceof TypeError;
          return transientRead && failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

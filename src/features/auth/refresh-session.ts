import type { QueryClient } from '@tanstack/react-query';

/** Drop cached private shopping projections before restoring the newly selected identity. */
export async function refreshSessionQueries(client: QueryClient): Promise<void> {
  await client.cancelQueries({ queryKey: ['shopping'] });
  client.removeQueries({ queryKey: ['shopping'] });
  await client.invalidateQueries({ queryKey: ['auth', 'session'] });
}

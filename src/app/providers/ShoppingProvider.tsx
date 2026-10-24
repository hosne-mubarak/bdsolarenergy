import { useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createShoppingServices } from '../../services/shopping';
import { RepositoryContext } from './repository-context';
import { ToastContext } from './toast-context';
import { ShoppingContext } from './shopping-context';

export function ShoppingProvider({ children }: { children: ReactNode }) {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error('RepositoryProvider is required');
  const [services] = useState(() => createShoppingServices(repositories));
  const client = useQueryClient();
  const toast = useContext(ToastContext);
  const noticeCount = useRef(0);
  useEffect(() => {
    const unsubscribe = services.store.subscribe(() => {
      void client.invalidateQueries({ queryKey: ['shopping'] });
      void client.invalidateQueries({ queryKey: ['auth', 'session'] });
      const notices = services.store.notices();
      if (notices.length > noticeCount.current) toast?.notify(notices.at(-1)!);
      noticeCount.current = notices.length;
    });
    const external = (event: StorageEvent) => services.store.externalChange(event.key);
    window.addEventListener('storage', external);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', external);
    };
  }, [client, services, toast]);
  return <ShoppingContext.Provider value={services}>{children}</ShoppingContext.Provider>;
}

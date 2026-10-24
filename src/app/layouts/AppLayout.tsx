import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/useAuth';
import { useShoppingServices } from '../../features/store/useShoppingServices';
import { Outlet, useLocation } from 'react-router';
import { StoreHeader } from '../../components/navigation/StoreHeader';
import { StoreFooter } from '../../components/navigation/StoreFooter';
import { Breadcrumbs } from '../../components/navigation/Breadcrumbs';

export function AppLayout() {
  const auth = useAuth();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus();
  }, [pathname]);
  const { customers } = useShoppingServices();
  const preferences = useQuery({
    queryKey: ['shopping', 'preferences', auth.data?.userId],
    enabled: Boolean(auth.data) && !auth.isTransitioning,
    queryFn: ({ signal }) => customers.getPreferences({ signal }),
  });
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <StoreHeader />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`container page-main ${preferences.data?.compactCards ? 'compact-products' : ''}`}
      >
        <Breadcrumbs />
        <Outlet />
      </main>
      <StoreFooter />
    </>
  );
}

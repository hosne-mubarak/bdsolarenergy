import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth';
import { safeReturnPath } from '../../domain/auth/redirect';
import { ErrorState, LoadingState } from '../../components/common/Feedback';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isPending) return <LoadingState message="Restoring your demo session…" />;
  if (auth.isTransitioning) {
    // Keep the logout action mounted until its awaited home navigation commits.
    if (['/logout', '/account/settings'].includes(location.pathname.replace(/\/+$/, '')))
      return <Outlet />;
    return <LoadingState message="Restoring your demo session…" />;
  }
  if (auth.isError) return <ErrorState error={auth.error} onRetry={() => void auth.refetch()} />;
  if (!auth.data)
    return (
      <Navigate
        replace
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  return <Outlet />;
}
export function GuestOnlyRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isPending) return <LoadingState message="Restoring your demo session…" />;
  if (auth.isError) return <ErrorState error={auth.error} onRetry={() => void auth.refetch()} />;
  if (auth.data && !auth.isTransitioning)
    return (
      <Navigate replace to={safeReturnPath(new URLSearchParams(location.search).get('returnTo'))} />
    );
  return <Outlet />;
}

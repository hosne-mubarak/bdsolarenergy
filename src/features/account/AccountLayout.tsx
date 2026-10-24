import { NavLink, Outlet } from 'react-router';
import { useAccountNavigation } from './useAccount';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
export function AccountLayout() {
  const navigation = useAccountNavigation();
  return (
    <div className="account-layout">
      <aside className="account-nav">
        <h2>Your account</h2>
        {navigation.isPending ? (
          <LoadingState message="Loading account navigation…" />
        ) : navigation.isError ? (
          <ErrorState error={navigation.error} onRetry={() => void navigation.refetch()} />
        ) : (
          <nav aria-label="Account navigation">
            {navigation.data.map((item) => (
              <NavLink key={item.id} to={item.path} end={item.path === '/account'}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </aside>
      <div className="account-content">
        <Outlet />
      </div>
    </div>
  );
}

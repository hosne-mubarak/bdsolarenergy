import { useOrders } from '../orders/useOrders';
import { formatMoney } from '../../utils/currency';
import { Link } from 'react-router';
import { useProfile } from './useAccount';
import { useCart } from '../cart/useCart';
import { useWishlist } from '../wishlist/useWishlist';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
export function DashboardPage() {
  const profile = useProfile();
  const orders = useOrders(1, 3);
  const cart = useCart();
  const wishlist = useWishlist();
  if (profile.isPending) return <LoadingState message="Loading your account…" />;
  if (profile.isError)
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">WELCOME BACK, {profile.data.displayName}</p>
        <h1>Your account</h1>
        <p>Manage your profile, saved essentials and local demo purchases.</p>
      </div>
      <div className="account-cards">
        <Link to="/account/profile">
          <h2>Profile details</h2>
          <p>{profile.data.email}</p>
        </Link>
        <Link to="/cart">
          <h2>Your cart</h2>
          <p>
            {cart.isError
              ? 'Cart information unavailable. Open your cart to retry.'
              : cart.data
                ? `${cart.data.lines.reduce((total, line) => total + line.quantity, 0)} items`
                : 'View current selection'}
          </p>
        </Link>
        <Link to="/account/wishlist">
          <h2>Saved essentials</h2>
          <p>
            {wishlist.isError
              ? 'Wishlist information unavailable. Open your wishlist to retry.'
              : wishlist.data
                ? `${wishlist.data.productIds.length} saved products`
                : 'View your wishlist'}
          </p>
        </Link>
      </div>
      <section>
        <h2>Recent orders</h2>
        {orders.isPending ? (
          <LoadingState message="Loading recent orders…" />
        ) : orders.isError ? (
          <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
        ) : orders.data.total ? (
          <ul>
            {orders.data.items.map((order) => (
              <li key={order.id}>
                <Link to={`/account/orders/${order.id}`}>
                  {order.id} · {formatMoney(order.totals.total)} · {order.status}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No demo orders yet.</p>
        )}
        <Link to="/account/orders">View order history</Link>
      </section>
      <p className="demo-notice">
        This is a local demonstration. Account checks and purchases are simulated, not production
        authentication.
      </p>
    </section>
  );
}

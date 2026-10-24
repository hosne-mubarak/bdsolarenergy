import { Link, useParams } from 'react-router';
import { useOrder } from './useOrders';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
import { OrderSnapshot } from '../../components/orders/OrderSnapshot';
export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const query = useOrder(orderId);
  if (query.isPending) return <LoadingState message="Loading order…" />;
  if (query.isError)
    return <ErrorState resource="Order" error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section className="order-page">
      <div className="page-heading">
        <h1>Order details</h1>
        <p>Saved demo snapshot. No real payment or delivery.</p>
      </div>
      <OrderSnapshot order={query.data} />
      <div className="action-row">
        <Link className="button button-primary" to={`/account/orders/${query.data.id}/tracking`}>
          Track demo order
        </Link>
        <Link className="button button-secondary" to="/account/orders">
          Back to order history
        </Link>
      </div>
    </section>
  );
}

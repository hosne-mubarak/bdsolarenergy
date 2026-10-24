import { Link, useParams } from 'react-router';
import { useOrder } from './useOrders';
import { LoadingState, ErrorState } from '../../components/common/Feedback';
import { OrderSnapshot } from '../../components/orders/OrderSnapshot';
export function ConfirmationPage() {
  const { orderId = '' } = useParams();
  const query = useOrder(orderId);
  if (query.isPending) return <LoadingState message="Loading order confirmation…" />;
  if (query.isError)
    return <ErrorState resource="Order" error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section className="order-page">
      <div className="page-heading">
        <p className="eyebrow">Saved in this browser</p>
        <h1>Demo order confirmed</h1>
        <p role="status">No real payment was collected. No delivery will occur.</p>
      </div>
      <OrderSnapshot order={query.data} />
      <div className="action-row">
        <Link className="button button-primary" to="/account/orders">
          View order history
        </Link>
        <Link className="button button-secondary" to="/products">
          Continue shopping
        </Link>
      </div>
    </section>
  );
}

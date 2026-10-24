import { Link, useParams } from 'react-router';
import { useOrder, useTracking } from './useOrders';
import { ErrorState, LoadingState } from '../../components/common/Feedback';
export function TrackingPage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);
  const tracking = useTracking(orderId);
  if (order.isPending || tracking.isPending)
    return <LoadingState message="Loading demo tracking…" />;
  const error = order.error ?? tracking.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void order.refetch();
          void tracking.refetch();
        }}
      />
    );
  return (
    <section>
      <div className="page-heading">
        <h1>Demo order tracking</h1>
        <p>Reference: {orderId}</p>
        <p>
          This is a static local timeline. No live shipment or courier booking exists. Time passing
          does not create delivery events.
        </p>
      </div>
      <ol className="tracking-timeline">
        {tracking.data!.map((event, index) => (
          <li key={`${event.at}-${index}`}>
            <h2>{event.status} · demo</h2>
            <p>{event.label}</p>
            <time dateTime={event.at}>
              {new Intl.DateTimeFormat('en-BD', {
                timeZone: 'Asia/Dhaka',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(event.at))}{' '}
              (Dhaka)
            </time>
          </li>
        ))}
      </ol>
      <Link className="button button-secondary" to={`/account/orders/${orderId}`}>
        Back to order details
      </Link>
    </section>
  );
}

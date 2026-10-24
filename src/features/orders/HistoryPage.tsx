import { Link, useSearchParams } from 'react-router';
import { useOrders } from './useOrders';
import { EmptyState, ErrorState, LoadingState } from '../../components/common/Feedback';
import { Pagination } from '../../components/products/Pagination';
import { formatMoney } from '../../utils/currency';
export function HistoryPage() {
  const [search, setSearch] = useSearchParams();
  const parsed = Number(search.get('page') ?? 1);
  const query = useOrders(Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1);
  if (query.isPending) return <LoadingState message="Loading order history…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return (
    <section>
      <div className="page-heading">
        <h1>Order history</h1>
        <p>Local demo purchases stored in this browser.</p>
      </div>
      {query.data.total ? (
        <>
          <ul className="history-list">
            {query.data.items.map((order) => (
              <li key={order.id}>
                <article>
                  <h2>{order.id}</h2>
                  <p>
                    {new Intl.DateTimeFormat('en-BD', {
                      timeZone: 'Asia/Dhaka',
                      dateStyle: 'medium',
                    }).format(new Date(order.createdAt))}{' '}
                    · {order.status} · demo
                  </p>
                  <p>
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} items ·{' '}
                    {formatMoney(order.totals.total)}
                  </p>
                  <Link className="button button-secondary" to={`/account/orders/${order.id}`}>
                    View order details<span className="sr-only"> for {order.id}</span>
                  </Link>
                </article>
              </li>
            ))}
          </ul>
          <Pagination
            label="Order pagination"
            page={query.data.page}
            total={query.data.total}
            pageSize={query.data.pageSize}
            onPage={(page) => {
              const next = new URLSearchParams(search);
              next.set('page', String(page));
              setSearch(next);
            }}
          />
        </>
      ) : (
        <EmptyState
          title="No demo orders yet"
          description="Your completed demo purchases will appear here."
          action={
            <Link className="button button-primary" to="/products">
              Browse products
            </Link>
          }
        />
      )}
    </section>
  );
}

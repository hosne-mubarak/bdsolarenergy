import type { Order } from '../../types';
import { OrderSummary } from './OrderSummary';
export function OrderSnapshot({ order }: { order: Order }) {
  return (
    <>
      <dl className="order-meta">
        <div>
          <dt>Reference</dt>
          <dd>{order.id}</dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>
            <time dateTime={order.createdAt}>
              {new Intl.DateTimeFormat('en-BD', {
                timeZone: 'Asia/Dhaka',
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(order.createdAt))}{' '}
              (Dhaka)
            </time>
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className="status-badge">{order.status} · demo</span>
          </dd>
        </div>
        <div>
          <dt>Payment method</dt>
          <dd>{order.paymentMethodId} · simulation only</dd>
        </div>
        <div>
          <dt>Delivery method</dt>
          <dd>{order.shippingMethodId} · simulation only</dd>
        </div>
        {order.couponCode && (
          <div>
            <dt>Coupon</dt>
            <dd>{order.couponCode}</dd>
          </div>
        )}
      </dl>
      <h2>Delivery address snapshot</h2>
      <address>
        {order.address.recipient}
        <br />
        {order.address.street}, {order.address.area}
        <br />
        {order.address.district}, {order.address.division} {order.address.postcode}
        <br />
        {order.address.phone}
      </address>
      <h2>Order summary</h2>
      <OrderSummary items={order.items} totals={order.totals} />
    </>
  );
}

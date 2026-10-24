import type { OrderItem, Totals } from '../../types';
import { formatMoney } from '../../utils/currency';
export function OrderSummary({ items, totals }: { items: OrderItem[]; totals: Totals }) {
  return (
    <div className="order-summary">
      <ul className="order-items">
        {items.map((item) => (
          <li key={item.variantId}>
            <div>
              <strong>{item.productName}</strong>
              <p>
                {item.sku} · Quantity {item.quantity} · {formatMoney(item.unitPrice)} each
              </p>
            </div>
            <strong>{formatMoney(item.lineTotal)}</strong>
          </li>
        ))}
      </ul>
      <dl className="totals-list">
        {(
          [
            ['Subtotal', totals.subtotal],
            ['Discount', -totals.discount],
            ['Delivery', totals.shipping],
            ['Tax (included)', totals.tax],
            ['Total', totals.total],
          ] as const
        ).map(([label, amount]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{amount < 0 ? `−${formatMoney(-amount)}` : formatMoney(amount)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { Trash2 } from 'lucide-react';
import { useCart, useCartActions } from './useCart';
import { useCartView } from './useCartView';
import { ErrorState, LoadingState, EmptyState } from '../../components/common/Feedback';
import { Button, Dialog } from '../../components/common/primitives';
import { Field } from '../../components/forms/Fields';
import { QuantitySelector } from '../../components/products/QuantitySelector';
import { formatMoney } from '../../utils/currency';
import { useToast } from '../../components/common/useToast';

export function CartPage() {
  const cart = useCart();
  const actions = useCartActions();
  const { notify } = useToast();
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const view = useCartView(cart.data, applied);
  if (cart.isPending) return <LoadingState message="Restoring your cart…" />;
  if (cart.isError) return <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />;
  if (cart.data.lines.length === 0)
    return (
      <EmptyState
        title="Your cart is empty"
        description="Find the right essentials for your next project."
        action={
          <Link to="/products" className="button button-primary">
            Explore products
          </Link>
        }
      />
    );
  if (view.isPending) return <LoadingState message="Checking current prices…" />;
  if (view.isError) return <ErrorState error={view.error} onRetry={() => void view.refetch()} />;
  const data = view.data;
  async function change(input: Parameters<typeof actions.mutateAsync>[0]) {
    try {
      await actions.mutateAsync(input);
      notify(input.type === 'clear' ? 'Cart cleared' : 'Cart updated');
      if (input.type === 'clear') setClearOpen(false);
    } catch {
      /* Normalized mutation error is displayed below. */
    }
  }
  return (
    <section className="cart-page">
      <div className="page-heading">
        <p className="eyebrow">YOUR NEXT PROJECT</p>
        <h1>Shopping cart</h1>
        <p>Review your selection. Prices are checked against the current demo catalogue.</p>
      </div>
      {actions.isError && (
        <p role="alert" className="field-error">
          {actions.error.message}
        </p>
      )}
      {data.notices.map((notice, index) => (
        <p key={index} role="status" className="demo-notice">
          {notice}
        </p>
      ))}
      <div className="cart-layout">
        <div>
          <div className="cart-items">
            {data.items.map((item) => {
              const product = data.products.find((record) => record.id === item.productId)!;
              const variant = product.variants.find((record) => record.id === item.variantId)!;
              const image = data.images.find((record) => record.id === item.imageId);
              return (
                <article className="cart-item" key={item.variantId}>
                  {image && <img src={image.src} alt={image.alt} width="150" height="100" />}
                  <div className="cart-item-copy">
                    <h2>
                      <Link to={`/product/${product.slug}`}>{item.productName}</Link>
                    </h2>
                    <p>{item.sku}</p>
                    <strong>{formatMoney(item.unitPrice)}</strong>
                    <QuantitySelector
                      label={`Quantity for ${item.productName}`}
                      value={item.quantity}
                      onChange={(quantity) =>
                        void change({ type: 'set', variantId: item.variantId, quantity })
                      }
                      max={Math.min(variant.stock, variant.maxPerOrder)}
                      disabled={actions.isPending}
                    />
                  </div>
                  <div className="cart-item-end">
                    <strong>{formatMoney(item.lineTotal)}</strong>
                    <Button
                      variant="secondary"
                      onClick={() => void change({ type: 'remove', variantId: item.variantId })}
                      disabled={actions.isPending}
                      aria-label={`Remove ${item.productName}`}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="cart-bottom-links">
            <Link className="text-action" to="/products">
              Continue shopping
            </Link>
            <Button variant="secondary" onClick={() => setClearOpen(true)}>
              Clear cart
            </Button>
          </div>
        </div>
        <aside className="cart-summary">
          <h2>Order summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(data.subtotal)}</dd>
            </div>
            {data.discount > 0 && (
              <div>
                <dt>Coupon discount</dt>
                <dd>−{formatMoney(data.discount)}</dd>
              </div>
            )}
            <div>
              <dt>Delivery</dt>
              <dd>Calculated at checkout</dd>
            </div>
            <div className="summary-total">
              <dt>After discount</dt>
              <dd>{formatMoney(data.subtotal - data.discount)}</dd>
            </div>
          </dl>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setApplied(code);
            }}
          >
            <Field
              id="coupon-code"
              label="Coupon code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={data.couponError ?? undefined}
            />
            <Button type="submit" variant="secondary">
              Apply coupon
            </Button>
            {data.couponApplied && (
              <p className="coupon-success" role="status">
                Coupon applied. Final delivery discount is checked at checkout.
              </p>
            )}
          </form>
          <Link
            to={`/checkout${data.couponApplied ? `?coupon=${encodeURIComponent(applied)}` : ''}`}
            className="button button-primary"
          >
            Proceed to checkout
          </Link>
          <p className="sample-label">Demo only. No payment will be collected.</p>
        </aside>
      </div>
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)} title="Clear your cart?">
        <p>This removes all items from your current cart.</p>
        <div className="action-row">
          <Button variant="secondary" onClick={() => setClearOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={actions.isPending}
            onClick={() => void change({ type: 'clear' })}
          >
            Clear cart
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

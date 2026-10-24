import { useEffect, useRef, useState } from 'react';
import { addressInputSchema } from '../../schemas';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AddressInput, CheckoutInput, Quote, Order } from '../../types';
import { AddressForm } from '../../components/forms/AddressForm';
import { Button } from '../../components/common/primitives';
import { ErrorState, EmptyState, LoadingState } from '../../components/common/Feedback';
import { useAddresses } from '../account/useAccount';
import { useCart } from '../cart/useCart';
import { useShoppingServices } from '../store/useShoppingServices';
import { useRepositories } from '../store/useStore';
import { usePlaceOrder } from './usePlaceOrder';
import { OrderSummary } from '../../components/orders/OrderSummary';

export function CheckoutPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const placement = usePlaceOrder();
  const [placed, setPlaced] = useState<Order | null>(null);
  const addresses = useAddresses();
  const { content } = useRepositories();
  const { orders } = useShoppingServices();
  const config = useQuery({
    queryKey: ['content', 'checkout'],
    queryFn: ({ signal }) => content.getCheckoutConfiguration({ signal }),
  });
  const [search] = useSearchParams();
  const [address, setAddress] = useState<AddressInput | null>(null);
  const [savedId, setSavedId] = useState('');
  const [shipping, setShipping] = useState('');
  const [payment, setPayment] = useState('');
  const [coupon, setCoupon] = useState(search.get('coupon') ?? '');
  const [accepted, setAccepted] = useState(false);
  const [review, setReview] = useState<Quote | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const addressHeading = useRef<HTMLHeadingElement>(null);
  const wasReviewing = useRef(false);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
    else if (wasReviewing.current) addressHeading.current?.focus();
    wasReviewing.current = Boolean(review);
  }, [review]);
  const quote = useMutation({
    mutationFn: (input: CheckoutInput) => orders.quote(input),
    onSuccess: setReview,
  });
  if (placed)
    return (
      <section>
        <h1>Demo order placed</h1>
        <p>Reference: {placed.id}</p>
        <p>No real payment was collected and no delivery will occur.</p>
        <Link className="button button-primary" to={`/order-confirmation/${placed.id}`}>
          View order confirmation
        </Link>
      </section>
    );
  if (cart.isPending || config.isPending || addresses.isPending)
    return <LoadingState message="Loading checkout…" />;
  const error = cart.error ?? config.error ?? addresses.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void cart.refetch();
          void config.refetch();
          void addresses.refetch();
        }}
      />
    );
  if (!cart.data?.lines.length && !review)
    return (
      <EmptyState
        title="Your cart is empty"
        description="Add products before starting checkout."
        action={
          <Link className="button button-primary" to="/products">
            Browse products
          </Link>
        }
      />
    );
  const delivery =
    shipping ||
    config.data!.shipping.find((method) =>
      method.districts.some(
        (district) => district.toLowerCase() === address?.district.toLowerCase(),
      ),
    )?.id ||
    config.data!.shipping[0]?.id ||
    '';
  const paymentId = payment || config.data!.payments.find((method) => method.enabled)?.id || '';
  return (
    <section className="checkout-page">
      <div className="page-heading">
        <p className="eyebrow">Your delivery choices</p>
        <h1>Checkout</h1>
        <p>Demonstration only. No real payment, delivery or merchant order is created.</p>
      </div>
      {review ? (
        <section className="checkout-review">
          <h2 ref={reviewHeading} tabIndex={-1}>
            Review your order
          </h2>
          <p>
            {review.input.address.recipient} · {review.input.address.phone}
          </p>
          <p>
            {review.input.address.street}, {review.input.address.area},{' '}
            {review.input.address.district}
          </p>
          <p>
            {
              config.data!.shipping.find((method) => method.id === review.input.shippingMethodId)
                ?.label
            }{' '}
            ·{' '}
            {
              config.data!.payments.find((method) => method.id === review.input.paymentMethodId)
                ?.label
            }
          </p>
          <OrderSummary items={review.items} totals={review.totals} />
          <p>
            Quote valid until{' '}
            {new Intl.DateTimeFormat('en-BD', {
              timeZone: 'Asia/Dhaka',
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(review.expiresAt))}{' '}
            (Dhaka time). Review again if prices or stock change.
          </p>
          {placement.isError && (
            <p role="alert" className="field-error">
              {placement.error.message} Edit checkout and review again if your cart or quote
              changed.
            </p>
          )}
          <Button
            disabled={placement.isPending}
            onClick={() => {
              void placement
                .submit(review)
                .then(async (order) => {
                  setPlaced(order);
                  await navigate(`/order-confirmation/${order.id}`, { replace: true });
                })
                .catch(() => {
                  /* Safe mutation error above. */
                });
            }}
          >
            Place demo order
          </Button>
          <Button
            variant="secondary"
            disabled={placement.isPending}
            onClick={() => {
              placement.reset();
              setReview(null);
            }}
          >
            Edit checkout
          </Button>
        </section>
      ) : (
        <div className="checkout-grid">
          <section className="checkout-panel">
            <h2 ref={addressHeading} tabIndex={-1}>
              Delivery address
            </h2>
            <label htmlFor="saved-address">Saved address</label>
            <select
              className="input"
              id="saved-address"
              value={savedId}
              onChange={(event) => {
                setSavedId(event.target.value);
                const selected = addresses.data!.find((item) => item.id === event.target.value);
                setAddress(selected ? addressInputSchema.parse(selected) : null);
              }}
            >
              {<option value="">New address</option>}
              {addresses.data!.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.recipient} — {item.street}
                  {item.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
            {!savedId && (
              <AddressForm
                defaultValues={address ?? undefined}
                showDefault={false}
                onDraftChange={() => setAddress(null)}
                submitLabel="Use this address"
                onSubmit={async (input) => {
                  setAddress(input);
                }}
              />
            )}
            {address && (
              <p role="status">
                Using address: {address.street}, {address.district}
              </p>
            )}
          </section>
          <section className="checkout-panel">
            <h2>Delivery and payment</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (address && accepted)
                  quote.mutate({
                    address,
                    shippingMethodId: delivery,
                    paymentMethodId: paymentId,
                    couponCode: coupon,
                    acceptedDemo: true,
                  });
              }}
            >
              <label htmlFor="shipping-method">Delivery method</label>
              <select
                className="input"
                id="shipping-method"
                value={delivery}
                onChange={(event) => setShipping(event.target.value)}
              >
                {config.data!.shipping.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label} ({method.estimatedDays.min}–{method.estimatedDays.max} days,
                    demo)
                  </option>
                ))}
              </select>
              <label htmlFor="payment-method">Payment method</label>
              <select
                className="input"
                id="payment-method"
                value={paymentId}
                onChange={(event) => setPayment(event.target.value)}
              >
                {config
                  .data!.payments.filter((method) => method.enabled)
                  .map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
              </select>
              <p>{config.data!.payments.find((method) => method.id === paymentId)?.description}</p>
              <label htmlFor="checkout-coupon">Coupon code</label>
              <input
                className="input"
                id="checkout-coupon"
                value={coupon}
                onChange={(event) => setCoupon(event.target.value)}
              />
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />{' '}
                I understand this is a demo order and no payment will be collected
              </label>
              {quote.isError && (
                <p role="alert" className="field-error">
                  {quote.error.message}
                </p>
              )}
              {!address && <p>Choose a saved address or validate a new address to continue.</p>}
              <Button type="submit" disabled={!address || !accepted || quote.isPending}>
                Review order
              </Button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

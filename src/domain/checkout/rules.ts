import type { Coupon, OrderItem, Product, ShippingMethod, Totals } from '../../types';
import { addMoney, assertMoney, multiplyMoney, RuleError, safeAmount } from '../errors';
import { validateQuantity } from '../cart/rules';

function itemSubtotal(items: OrderItem[]): number {
  return items.reduce((subtotal, item) => {
    const computed = multiplyMoney(item.unitPrice, item.quantity);
    assertMoney(item.lineTotal);
    if (item.lineTotal !== computed)
      throw new RuleError('conflict', 'Cart amounts have changed. Please review them again.');
    return addMoney(subtotal, computed);
  }, 0);
}

export function findCoupon(coupons: Coupon[], code: string): Coupon | undefined {
  const normalized = code.trim().normalize('NFKC').toUpperCase();
  if (!normalized) return undefined;
  const coupon = coupons.find((candidate) => candidate.code.trim().toUpperCase() === normalized);
  if (!coupon) throw new RuleError('validation', 'This coupon code is invalid.');
  return coupon;
}

export function couponDiscount(
  coupon: Coupon,
  items: OrderItem[],
  products: Product[],
  subtotal: number,
  now: Date,
): number {
  assertMoney(subtotal);
  if (subtotal !== itemSubtotal(items))
    throw new RuleError('conflict', 'Cart amounts have changed. Please review them again.');
  const instant = now.getTime();
  const start = Date.parse(coupon.startsAt);
  const end = Date.parse(coupon.endsAt);
  if (![instant, start, end].every(Number.isFinite) || start > end)
    throw new RuleError('validation', 'The coupon dates are invalid.');
  if (instant < start) throw new RuleError('validation', 'This coupon is not active yet.');
  if (instant > end) throw new RuleError('validation', 'This coupon has expired.');
  assertMoney(coupon.minimumSubtotal);
  if (subtotal < coupon.minimumSubtotal)
    throw new RuleError('validation', 'The coupon minimum order amount has not been reached.');
  let eligibleCount = 0;
  const eligibleSubtotal = items.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product)
      throw new RuleError('not_found', 'A product in the order is no longer available.');
    if (
      !coupon.eligibleCategoryIds.length ||
      coupon.eligibleCategoryIds.includes(product.categoryId)
    ) {
      eligibleCount++;
      return addMoney(sum, item.lineTotal);
    }
    return sum;
  }, 0);
  if (eligibleCount === 0)
    throw new RuleError('validation', 'This coupon does not apply to the items in your cart.');
  assertMoney(coupon.amount);
  let discount: number;
  if (coupon.type === 'percentage') {
    if (coupon.amount > 100) throw new RuleError('validation', 'The coupon percentage is invalid.');
    discount = safeAmount((BigInt(eligibleSubtotal) * BigInt(coupon.amount)) / 100n);
  } else if (coupon.type === 'fixed') discount = Math.min(coupon.amount, eligibleSubtotal);
  else if (coupon.type === 'free_shipping') {
    if (coupon.amount !== 0)
      throw new RuleError('validation', 'The free-delivery coupon is invalid.');
    discount = 0;
  } else throw new RuleError('validation', 'This coupon type is invalid.');
  if (coupon.maximumDiscount !== null) {
    assertMoney(coupon.maximumDiscount);
    discount = Math.min(discount, coupon.maximumDiscount);
  }
  return Math.min(discount, eligibleSubtotal);
}

export interface TotalsInput {
  items: OrderItem[];
  products: Product[];
  coupon?: Coupon;
  shipping: ShippingMethod;
  district: string;
  minimumOrder: number;
  now: Date;
}

export function calculateTotals({
  items,
  products,
  coupon,
  shipping,
  district,
  minimumOrder,
  now,
}: TotalsInput): Totals {
  if (!items.length)
    throw new RuleError('validation', 'Add products to your cart before checking out.');
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.variantId))
      throw new RuleError('validation', 'The cart contains a duplicate product option.');
    seen.add(item.variantId);
    const product = products.find((candidate) => candidate.id === item.productId);
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId);
    if (!variant)
      throw new RuleError('not_found', 'A product option in the order is no longer available.');
    validateQuantity(item.quantity, variant);
    if (item.unitPrice !== variant.price)
      throw new RuleError('conflict', 'A product price has changed. Please review your cart.');
  }
  const subtotal = itemSubtotal(items);
  assertMoney(minimumOrder);
  if (subtotal < minimumOrder)
    throw new RuleError('validation', 'The minimum order amount has not been reached.');
  const zone = district.trim().toLocaleLowerCase('en');
  if (!shipping.districts.some((supported) => supported.trim().toLocaleLowerCase('en') === zone))
    throw new RuleError('validation', 'This delivery method is not available for your district.');
  assertMoney(shipping.fee);
  if (shipping.freeAbove !== null) assertMoney(shipping.freeAbove);
  const discount = coupon ? couponDiscount(coupon, items, products, subtotal, now) : 0;
  const discountedSubtotal = subtotal - discount;
  const shippingFee =
    coupon?.type === 'free_shipping' ||
    (shipping.freeAbove !== null && discountedSubtotal >= shipping.freeAbove)
      ? 0
      : shipping.fee;
  return {
    subtotal,
    discount,
    shipping: shippingFee,
    tax: 0,
    total: addMoney(discountedSubtotal, shippingFee),
  };
}

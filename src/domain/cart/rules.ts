import type { CartLine, OrderItem, Product, Variant } from '../../types';
import { addMoney, assertMoney, multiplyMoney, RuleError } from '../errors';

export function validateQuantity(quantity: number, variant: Variant, reserved = 0): void {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new RuleError('validation', 'Quantity must be a positive whole number.');
  if (
    !Number.isSafeInteger(variant.maxPerOrder) ||
    variant.maxPerOrder < 1 ||
    quantity > variant.maxPerOrder
  )
    throw new RuleError('validation', 'Quantity exceeds the per-order limit.');
  assertMoney(variant.stock);
  assertMoney(reserved);
  if (quantity > Math.max(0, variant.stock - reserved))
    throw new RuleError('conflict', 'There is not enough stock for this quantity.');
}

export function calculateCart(
  lines: CartLine[],
  products: Product[],
  reservations: Record<string, number> = {},
): { items: OrderItem[]; subtotal: number } {
  const seen = new Set<string>();
  let subtotal = 0;
  const items = lines.map((line): OrderItem => {
    if (seen.has(line.variantId))
      throw new RuleError('validation', 'The cart contains a duplicate product option.');
    seen.add(line.variantId);
    const product = products.find((candidate) =>
      candidate.variants.some((variant) => variant.id === line.variantId),
    );
    const variant = product?.variants.find((candidate) => candidate.id === line.variantId);
    if (!product || !variant)
      throw new RuleError('not_found', 'A product option in the cart is no longer available.');
    validateQuantity(line.quantity, variant, reservations[variant.id] ?? 0);
    const lineTotal = multiplyMoney(variant.price, line.quantity);
    subtotal = addMoney(subtotal, lineTotal);
    return {
      productId: product.id,
      variantId: variant.id,
      productName: product.name,
      sku: variant.sku,
      imageId: product.imageIds[0],
      quantity: line.quantity,
      unitPrice: variant.price,
      lineTotal,
    };
  });
  return { items, subtotal };
}

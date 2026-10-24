# Reusable commerce rules

All amounts are nonnegative safe integer poisha. BigInt intermediates guard multiplication, percentages and addition before returning bounded numbers. Display formatting preserves exact poisha even at the safe integer limit; formatted text is never fed into checkout arithmetic.

`calculateCart` resolves current variants, rejects duplicate/missing SKUs and validates integral positive quantity against max-per-order and unreserved stock. It returns immutable purchase-ready item projections and a subtotal; an empty cart is valid for display, but not for order creation.

`calculateTotals` verifies item arithmetic/current SKU prices and then applies the configured coupon, delivery zone/free threshold and tax-inclusive policy. Store minimum and coupon minimum use pre-discount merchandise subtotal. Coupon categories refer to exact configured category IDs; percentage discounts floor to a whole poisha, and fixed/percentage amounts are capped at the eligible subtotal and configured maximum. A free-shipping coupon changes delivery only. Only one coupon object/code is accepted; no stacking.

Delivery eligibility is case-insensitive and whitespace-tolerant. Free-delivery thresholds use discounted subtotal. Extra tax is zero because fixtures explicitly declare tax-inclusive pricing. Checkout services must re-resolve stock and quote inputs at submission rather than trust displayed totals.

Pure modules throw `RuleError` for known safe validation/conflict/not-found failures. Repository normalization maps them to public error codes. Arbitrary exceptions remain generic unavailable failures, never raw exception text. The browser demo still needs backend atomic inventory/payment validation before production.

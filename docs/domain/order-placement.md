# Demo order placement

The UI calls `OrderRepository.quote` to review current prices and then `CheckoutAttemptRepository.getOrCreate(quoteId)` before `placeOrder(input, key)`. Both interfaces are adapter boundaries. Pages never read browser storage or fixture JSON. The checkout acknowledgement and every payment method explicitly describe a simulation; this application collects no card, bank, mobile account, PIN or payment-provider credentials.

A quote is a ten-minute, owner-scoped snapshot. It contains normalized delivery/payment/coupon inputs, current line snapshots and domain-calculated totals. Saving a quote does not reserve stock or place an order. Editing a new address invalidates its selected validation result; checkout retains form values between review and editing.

## Retry and ownership

The attempts adapter saves one idempotency key per owner and reviewed quote in the versioned `checkout-attempts` aggregate. A retry or a newly created service instance receives that same key. Creating a new attempt requires the current owner's quote. Existing keys remain available after quote expiry so a successful order can still be recovered.

`placeOrder` resolves identity through the authentication adapter. It first searches for an existing order with the same owner and key, before requiring a nonempty cart or unexpired quote. A successful retry therefore returns the original immutable snapshot even after the cart was cleared or catalogue data changed. An order belonging to a different customer is never returned. The UI also blocks overlapping submission actions while a request is pending.

## Validation and commit

Before a new order is written, the adapter:

1. Validates strict checkout inputs and the explicit demo acknowledgement.
2. Reads the current owner's cart and its aggregate revision, resolves current products and delivery/payment configuration, and confirms the session still has the same owner.
3. Rejects changed revisions, unavailable variants, excess quantities, insufficient unreserved stock, unsupported districts, disabled payment methods, invalid/expired coupons and unmet minimums. Domain functions compute integer-poisha totals with overflow checks.
4. Requires the current owner's stored, unexpired `expectedQuoteId`. Normalized inputs, line snapshots and totals must match the reviewed snapshot. A changed price or checkout choice requires review again.
5. Creates immutable order items, totals, delivery address, methods, coupon, timestamp and a deterministic initial demo tracking event.
6. Uses one revision-checked `checkout` aggregate write to append the order, increment variant reservations and clear only that owner's cart. Other carts, orders and reservations remain in that same aggregate.

A failed storage write leaves the previously stored cart, orders and reservations intact. The attempts record can already exist, which is intentional: retrying uses the same key. No additional persistence operation after the successful aggregate commit is required for success. If another submission won during asynchronous preparation, the adapter repeats the owned idempotency lookup and returns that order instead of reporting a duplicate failure.

## Scope and limits

These are browser-local demo guarantees. The revision check detects observed changes; `localStorage` does not provide an atomic compare-and-swap across independently executing tabs, processes or devices. Concurrent cross-tab inventory placement can still race between revision read and write. Reservations apply only to this browser's aggregate, and no live inventory, real payment capture, merchant order or shipment is created. Browser-side ownership can be bypassed by someone who controls the browser.

A future backend must enforce authentication and ownership, transactional inventory reservations and an idempotency key with durable request/result semantics on the server. Its adapter must preserve the public conflict/error behavior and pass the same behavioral tests before production use.

## Verification entry points

Run the quote, order-placement and checkout-attempt contract suites under `tests/contracts`, plus checkout interaction tests under `src/features/checkout`. Injected runtimes supply deterministic IDs/time; in-memory persistence and storage faults exercise failures without a backend. Browser journeys and production handoff are verified in their later roadmap tasks; this document alone is not release evidence.

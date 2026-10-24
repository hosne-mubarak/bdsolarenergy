# Django REST Framework migration handoff

The completed frontend uses static fixtures and browser-side demo persistence. There is no DRF server, HTTP adapter, live payment, email delivery or merchant order integration. Every URL and DTO below is a **proposal for backend agreement**, not a tested API specification. The [current interfaces](repositories.md) and [schemas](../../src/schemas/index.ts) are the exact frontend contract today.

## Preserve the boundary; negotiate live semantics

Add future transport/DTO code under infrastructure services and select it at application composition. Pages and domain functions continue consuming repository entities; no screen should inspect DRF `results`, cookies, tokens or browser persistence. Public repositories and the shopping-service bundle have typed injection seams. The [replacement test](../../tests/integration/adapter-replacement.test.tsx) demonstrates that private order screens can consume a supplied contract implementation. It does not prove serializer compatibility, HTTP behavior or server authorization.

Only `VITE_DATA_SOURCE=json` is currently enabled. A future `api` branch must construct the negotiated adapters explicitly and fail visibly when configuration is invalid; it must not silently substitute fixture success after a network failure. `VITE_API_BASE_URL` is public build-time configuration, never a credential.

Several current contracts intentionally encode a demonstration. A backend sandbox may implement the same semantics, but enabling real commerce needs deliberate, versioned contract and user-flow changes:

| Current constraint                                                                               | Required decision before live integration                                                                                                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User.demo`, `Order.demoOnly`, payment `demoOnly` and verification `demoOnly` are literal `true` | Define live/sandbox DTO discriminators and update runtime schemas and affected notices; never label a live record as a demo to satisfy parsing                      |
| Checkout requires `acceptedDemo: true`; methods collect no payment credentials                   | Define real checkout consent and provider-hosted payment/intent/redirect/webhook states separately; a selected demo card/mobile option is not payment authorization |
| `requestReset` requires a local `demoIntentId`; reset/change methods are explicitly demo-named   | Version real recovery/verification contracts and screens; do not fabricate a local intent or an email-delivery claim for a backend response                         |
| Image schema permits only approved `/images/...` paths and local formats                         | Agree a validated media/CDN origin and URL policy, alt/dimension/provenance fields, caching and failure handling before changing the media schema                   |
| `taxInclusive: true`, BDT and illustrative Bangladesh zones/policies                             | Agree actual merchant tax, delivery, minimums, warranty and legal terms; the demo defaults are not commercial approval                                              |
| Reset removes local/tab demo namespaces                                                          | Keep browser cleanup distinct from backend account/data deletion; real deletion needs its own contract, authorization and retention rules                           |

A live backend therefore requires more than changing a URL. Keep the current browser demo unchanged until those decisions and migrations are approved.

## Proposed resources and endpoints

The prefix `/api/v1/` is illustrative. Server-side authentication determines ownership for every private resource; neither a path ID nor a submitted `user_id` authorizes access.

| Contract operations                                | Proposed transport mapping                                                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalogue lists/detail/variants/reviews            | `GET products/`, `GET products/{slug}/`, `GET products/by-id/{id}/`, `GET variants/{id}/`, `GET products/{id}/reviews/`                                              |
| Categories, brands, images                         | `GET categories/`, `GET brands/`, `GET images/` or negotiated media metadata embedded in catalogue DTOs                                                              |
| Content/settings/navigation/banners/pages          | `GET site-settings/`, `GET navigation/`, `GET account-navigation/`, `GET banners/`, `GET pages/{slug}/`                                                              |
| Checkout configuration/coupons/default preferences | `GET checkout-configuration/`, `GET coupons/`, `GET preference-defaults/`; expose only customer-safe coupon information                                              |
| Session/login/register/logout                      | `GET auth/session/`, `POST auth/login/`, `POST auth/register/`, `POST auth/logout/`                                                                                  |
| Future real recovery/verification/password change  | Negotiated `auth/password-reset/`, `auth/password-reset/confirm/`, `auth/verification/`, `auth/password/`; current demo-specific response types need evolution first |
| Profile/preferences                                | `GET/PATCH me/`, `GET/PATCH me/preferences/`; email remains read-only until a verified email-change flow is agreed                                                   |
| Address list/create/detail/update/delete           | `GET/POST me/addresses/`, `GET/PATCH/DELETE me/addresses/{id}/`; default promotion/demotion must be atomic per owner                                                 |
| Cart and guest merge                               | `GET cart/`, `POST cart/lines/`, `PATCH/DELETE cart/lines/{variant_id}/`, `DELETE cart/`, `POST cart/merge/`                                                         |
| Wishlist and guest merge                           | `GET wishlist/`, `POST wishlist/toggle/`, `POST wishlist/merge/`; negotiate toggle retry behavior or use idempotent add/remove transport internally                  |
| Quote/order/history/tracking                       | `POST checkout/quotes/`, `POST orders/`, `GET orders/`, `GET orders/{id}/`, `GET orders/{id}/tracking/`                                                              |
| `checkoutAttempts.getOrCreate`                     | Client-side retained key creation may remain local; server order processing enforces durable owner-scoped idempotency rather than trusting the client record         |

Contact submission is currently local validation only and has no repository delivery operation. A real inquiry service, abuse controls, operator-approved contact information and delivery feedback are additional backend/product work, not an implemented endpoint.

## DTO and query mapping

Map explicit fields in adapter functions rather than recursively renaming arbitrary server objects. Parse untrusted responses, normalize them into the frontend schema, and return copies. Reject missing, inconsistent or out-of-range values with a safe availability/validation error; do not silently round money, manufacture IDs or replace failed reads with an empty-success result.

| Wire proposal                                      | Frontend value and invariant                                                                                                                                                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `user_id`, `variant_id`                      | Opaque trimmed strings, maximum 100 characters; convert integer/UUID identifiers deliberately and never authorize from a caller-supplied owner                                                                                                         |
| `unit_price_poisha`, `line_total_poisha`, totals   | Nonnegative integers in BDT poisha, at most `Number.MAX_SAFE_INTEGER`; quantities/stock are safe integers too. If decimal-string taka is negotiated, parse exactly and reject excess precision/overflow instead of using floating-point multiplication |
| `created_at`, `expires_at`, event `at`             | Canonical UTC ISO timestamps ending in `Z`; current schemas reject offset-form timestamps. Normalize server precision deliberately; display uses Asia/Dhaka                                                                                            |
| `display_name`, `is_default`, `shipping_method_id` | Explicit camel-case fields such as `displayName`, `isDefault`, `shippingMethodId`; booleans remain booleans                                                                                                                                            |
| Product variants and summary                       | Preserve product/variant relationships, unique SKUs, selling/compare-at prices, limits and availability; ratings/counts must describe the same review set                                                                                              |
| Order items, address and totals                    | Immutable purchase snapshots, not joins that change after profile, address, catalogue or pricing edits                                                                                                                                                 |
| Coupon `type` and `amount`                         | Percentage uses an integer percentage; fixed uses poisha; free-shipping amount is zero. One active eligible coupon and current minimum/cap rules remain authoritative                                                                                  |

Example **proposed sandbox quote request**:

```json
{
  "address": {
    "recipient": "Sample Customer",
    "phone": "01812345678",
    "division": "Dhaka",
    "district": "Dhaka",
    "area": "Dhanmondi",
    "street": "House 10, Road 5",
    "postcode": "1209",
    "is_default": false
  },
  "shipping_method_id": "shipping-dhaka",
  "payment_method_id": "payment-mobile",
  "coupon_code": "SOLAR10",
  "accepted_demo": true
}
```

The server resolves the current cart and identity. A quote reply supplies an opaque quote ID, owner metadata, current line snapshots/totals, normalized input and expiry. Order submission sends the reviewed `expected_quote_id` and retained idempotency key; no displayed client total is authoritative.

Catalogue query mapping must agree token/SKU search, Unicode normalization, category descendants, repeated brand IDs, integer-poisha price bounds, availability, collection and sort names. UI price inputs are taka converted to poisha before repository calls. Preserve stable sorting ties and shareable page/filter URLs rather than letting DRF defaults alter business semantics silently.

Current `Page<T>` is `{items,total,page,pageSize}`. A conventional DRF `{count,next,previous,results}` reply needs mapping to it; pages and hooks never parse the wire envelope. Product page size defaults to 12 with a maximum of 100; order listing defaults to 10 with a maximum of 50, while the history UI requests 5. JSON adapters clamp pages above the last result page. Agree how to preserve that behavior if the server uses DRF's out-of-range 404 or cursor pagination, including stable date/ID ordering for history.

## Authentication, CSRF and CORS decisions

Prefer a negotiated Django session-cookie design where appropriate: the session cookie is `HttpOnly`, `Secure` on HTTPS, and has an agreed `SameSite` and expiry policy. The frontend obtains safe session metadata from `auth/session/`; it never reads the session cookie or receives the browser demo's PBKDF verifier. Remember-me must set server-controlled session lifetime, not merely a local flag. Seeded demo credentials and local verifier records must never be imported as production accounts.

For Django SessionAuthentication, agree CSRF bootstrap and rotation, the readable CSRF token mechanism and the `X-CSRFToken` header on unsafe requests, including login and logout where required. Use `credentials: 'include'` only for the agreed cookie transport. Cross-origin hosting requires explicit allowed frontend origins, credential-enabled CORS and matching trusted CSRF origins; wildcard CORS with credentials is invalid. Cross-site cookies need an explicit HTTPS/SameSite design and browser testing. If token authentication is selected instead, renewal, revocation and storage policy remain unresolved work; do not quietly put long-lived tokens in localStorage.

On identity change/expiry/logout, retain safe internal return paths, wait for session restoration, cancel/remove private shopping queries and refresh the session. Query keys include the current owner. The existing transition fence prevents redirects overtaking sign-in/logout work; transport replacement must preserve its outcome, including server logout failure and partial guest-merge failure.

## Errors, cancellation and retry

Normalize agreed machine codes and field paths at the adapter boundary. `RepositoryError` currently supports `validation`, `not_found`, `conflict`, `unauthenticated`, `forbidden`, `storage_unavailable` and `unavailable`, plus a safe message and optional field-error arrays. A proposed DRF error body is `{code,detail,field_errors}`; nested snake-case field paths map deliberately to form names such as `address.phone`. Never render arbitrary HTML, debug tracebacks or credential-bearing response text.

| Transport condition                                             | Required contract behavior                                                                                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invalid fields / HTTP 400                                       | `validation`, preserving agreed safe field errors                                                                                                     |
| Missing or foreign private record / HTTP 404                    | Same nondisclosing `not_found`; no other customer's data in error bodies                                                                              |
| Stale quote, stock, revision or idempotency conflict / HTTP 409 | `conflict` with actionable re-review/reload guidance                                                                                                  |
| Expired/missing session / negotiated 401 or machine code        | `unauthenticated`; session restoration/guard handles safe sign-in return                                                                              |
| Permission or CSRF failure / HTTP 403                           | Distinguish agreed codes. DRF can return 403 for more than one reason; do not classify every 403 as logout or every CSRF failure as missing ownership |
| Network failure, rate limit or 5xx                              | Safe `unavailable`; negotiate retry-after metadata before exposing it through a versioned error contract                                              |
| Local guest/key/reset storage failure                           | `storage_unavailable`; do not falsely report that intent or an order was saved                                                                        |
| Aborted read                                                    | Preserve `AbortError` before/after transport and parsing; no failure toast, silent fallback or automatic retry                                        |

Read methods forward the caller's `AbortSignal` to transport and check cancellation after response mapping. The current query client bounds retries for transient reads. Mutations have no cancellation parameter or automatic retry policy. If the connection is lost after a server commit, cancellation cannot prove failure: recover the original result using the same submission key. Explicit safe retries must not toggle a wishlist twice, duplicate guest merges or create another order.

## Server transaction and idempotency requirements

The browser demo's revision check is not a distributed transaction. The server must authenticate the owner, lock/version the authoritative cart and inventory, validate current prices/stock/minimum/coupon/district/methods, validate quote expiry and exact reviewed input, and atomically persist immutable order data, reservations and cart clearing. Real payment confirmation and webhook verification must be part of an agreed server workflow, not inferred from a frontend selection.

`Idempotency-Key` is a proposed request header for `POST orders/`. Persist its result durably under the authenticated owner and check it before rejecting an already-cleared cart or expired review. Repeated and simultaneous submissions must recover one order, including a lost response. Define retention, database uniqueness, concurrency locking, payload hashing and same-key/different-payload behavior explicitly. The current demo returns the original owned order by key before validating new inputs; a stricter server 409 on changed payload must be negotiated and tested. The client should retain the original request/key for retry and create a new key only for a newly reviewed checkout.

Guest merge is a separate concern. Cart and wishlist merges currently commit separately and are repeatable; a second merge may fail after the first succeeded. Preserve intent and expose partial failure rather than claiming one global transaction. A server may offer a stronger combined endpoint, but its adapter must map the same observable success/retry behavior. Stock, cross-device sync and real order ownership become server responsibilities; local revision counters and owner keys remain insufficient security controls.

## Adapter acceptance harness and backend work

1. Agree/version the demo-vs-live, media, money/time, auth, pagination, error, quote, idempotency and payment contracts before enabling API mode.
2. Implement explicit DTO serializers/mappers and transport under services; inject them at composition. Keep public types, domain rules and pages free of transport details.
3. Parameterize the relevant [contract suites](../../tests/contracts) for both adapters, preserving deterministic clock/ID fixtures and resetting each backend test database. Reuse the [business-risk matrix](../testing/test-matrix.md), [purchase lifecycle](../../tests/integration/purchase-lifecycle.test.ts) and [replacement proof](../../tests/integration/adapter-replacement.test.tsx).
4. Add actual HTTP tests for valid/malformed DTOs, unsafe money/time values, pagination boundaries, aborted/delayed reads, network/5xx failures, 401/403/CSRF distinctions, cookie expiry/logout, ownership, concurrent stock contention and duplicate/lost-response order submissions. A typed in-memory adapter is not evidence that these transport cases pass.
5. Run the full feature/browser purchase and account journeys against the real sandbox, then the built frontend on the selected host. Include Firefox/WebKit, which remain blocked in this environment as recorded in [browser evidence](../testing/browser-journeys.md).
6. Before live release, complete server security/payment/shipping/email operations, owner/legal content review, real-host asset/fallback/HTTPS configuration and manual assistive-technology/device review. These are future integration/release gates, not features claimed by the completed JSON frontend.

Reproduce the current frontend boundary checks with `npm test -- --run tests/contracts tests/integration tests/unit/architecture.test.ts`. Run the documented [full checks](../testing/test-matrix.md) as well. Current execution evidence belongs to [implementation progress](../implementation-progress.md); this proposal makes no actual backend compatibility claim.

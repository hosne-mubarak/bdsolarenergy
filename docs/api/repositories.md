# Repository contracts

Feature hooks depend on asynchronous contracts in `src/services/contracts`, not JSON imports or network calls. The domain entity types come from `src/types`; Zod schemas define runtime boundary validation. Reads accept cancellation options. A normalized error code separates validation/not-found/conflict/auth/availability failures from transport-specific details.

Catalogue and content are public reads. Cart/wishlist resolve the current guest/account owner internally. Customer and order operations resolve the current session and enforce demo ownership rather than trusting a caller-supplied user ID. Login/logout orchestration must clear account-scoped caches and merge guest data through repository operations, not duplicate component effects.

## Selection and injection

The composition root validates `VITE_DATA_SOURCE` once. Only `json` is supported initially. Unknown modes fail explicitly; do not silently fall back to JSON when an API is unavailable. Factories defer adapter creation until configuration is validated. Inject clock and ID generation into services for deterministic coupon/session/order tests. Never accept a displayed total as an authoritative quote.

The initial contract tests use a typed fake adapter to demonstrate substitution and exercise normalized error/selection/cancellation behavior. Concrete JSON adapters will run contract behavior tests as implemented. Authentication/payment/order methods must not return invented success while unimplemented.

## Proposed future DRF mapping

Endpoints in the approved plan are proposals only. A future API adapter must map DTOs, pagination, query parameters, error shapes, cancellation, authentication headers/cookies and CSRF inside infrastructure. No page should inspect a DRF `results` field or read an access token. Domain amounts remain integer poisha even if a negotiated wire contract uses decimal strings.

Backend integration must agree session security, CORS/CSRF, inventory transactions, idempotency and payment verification before enabling API mode. No frontend ownership check, fixture verifier or local reservation is a production security control. See the approved plan section 7 for the complete migration acceptance scope.

## JSON read adapters (TASK-008)

`createJsonReadRepositories(runtime, fixtureData?)` provides catalogue/content contracts. The default loader validates every fixture and its relationships. Injected snapshots support deterministic tests. Reads honor abort signals before and after their asynchronous boundary and return copies rather than mutable imported records. Product summaries derive rating/count from reviews, and banner availability uses the injected clock.

This foundation covers detail/relationship reads and basic paginated lists. Catalogue filter/search/sort semantics are added and tested in TASK-013–015 before those controls are presented; TASK-008 does not claim those shopping features complete. All customer/authentication/order mutations remain assigned to later tasks.

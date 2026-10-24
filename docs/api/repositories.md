# Repository contracts

Feature hooks consume asynchronous interfaces in [contracts](../../src/services/contracts/index.ts). Entity types come from [types](../../src/types/index.ts) and runtime validation from [schemas](../../src/schemas/index.ts). Components do not import fixtures, call HTTP or read browser storage. The [architectural lint suite](../../tests/unit/architecture.test.ts) checks those boundaries, including application entry files.

## Implemented interfaces

| Interface                   | Current operations and result boundary                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CatalogueRepository`       | `listProducts`, `getProduct`, `getProductById`, `getVariant`, `listCategories`, `listBrands`, `listImages`, `getReviews`; validated catalogue entities and `Page<ProductSummary>`                       |
| `ContentRepository`         | `getAccountNavigation`, `getSiteSettings`, `getNavigation`, `getBanners`, `getPage`, `getCheckoutConfiguration`, `getCoupons`, `getDefaultPreferences`; fixture-defined public configuration/content    |
| `AuthRepository`            | `getDemoAccess`, `getSession`, `login`, `register`, `logout`, `requestReset`, `resetDemoPassword`, `getVerificationStatus`, `changeDemoPassword`; explicit browser-demo identity and recovery semantics |
| `CustomerRepository`        | `getProfile`, `updateProfile`, `listAddresses`, `getAddress`, `saveAddress`, `deleteAddress`, `getPreferences`, `updatePreferences`; current-session-owned customer data                                |
| `CartRepository`            | `getCart`, `add`, `setQuantity`, `removeLine`, `clear`, `mergeGuestCart`; current guest/account cart and merge notices                                                                                  |
| `WishlistRepository`        | `list`, `toggle`, `mergeGuestWishlist`; current guest/account product IDs                                                                                                                               |
| `OrderRepository`           | `quote`, `placeOrder`, `listOrders`, `getOrder`, `getTracking`; expiring review, immutable purchase snapshots and recorded demo events                                                                  |
| `CheckoutAttemptRepository` | `getOrCreate(quoteId)`; retained, owner-scoped submission key for the reviewed checkout                                                                                                                 |

`Repositories` groups the seven main repository interfaces. `CheckoutAttemptRepository` is a separate auxiliary contract, composed as `ShoppingServices.checkoutAttempts`. The shopping service bundle also contains the injected runtime, local/tab persistence bridges and namespace-reset action. These platform controls support the demo; they are not proposed backend account-deletion operations.

Catalogue/content are public reads. Cart and wishlist resolve ownership internally; customer/order operations require the current session. Callers never supply an authoritative account ID. Unknown and foreign address/order IDs share the same nondisclosing not-found behavior. Objects returned by JSON adapters are copies, so feature edits cannot mutate fixture or persisted state accidentally.

Reads accept `ReadOptions.signal`; `quote` also accepts it. Cancellation remains an `AbortError`, not a repository availability failure. Mutation contracts have no abort parameter: cancelling a read or leaving a page does not establish whether a server mutation committed. `RepositoryError` exposes only the agreed code, safe message and optional field errors. Raw transport bodies, stack traces and credentials do not reach screens.

## Composition and behavior

`VITE_DATA_SOURCE` selects `json` by default. Unsupported modes, including `api`, fail explicitly before constructing a fallback adapter. `VITE_API_BASE_URL` is reserved, public and unused. No API transport or working DRF compatibility is claimed.

`createJsonReadRepositories(runtime, fixtureData?)` supplies catalogue/content with validated fixture relationships, filtering/search/sorting, derived ratings and injected-time banner availability. `createShoppingServices` composes auth/customer/cart/wishlist/order/attempt adapters with the same runtime and persistence. Tests inject deterministic clocks, identifiers and stores. Unsupported or failed operations never return invented success.

`RepositoryProvider` accepts a typed public repository bundle. The shopping provider composition can receive an explicitly supplied service bundle through `AppProviders`; it defaults to the JSON service factory. The [adapter replacement integration test](../../tests/integration/adapter-replacement.test.tsx) exercises feature-facing substitution at that seam. This demonstrates the frontend boundary, not an HTTP protocol or backend authorization guarantee.

Identity transitions use repository merge operations, then cancel/remove private shopping queries and refresh the session. Query keys include the current owner. Guest cart and wishlist merges are separate repeatable aggregate operations; a partial failure is reported and does not pretend they formed one transaction. Order placement has stronger local semantics: one revision-checked checkout-aggregate write records the snapshot, updates reservations and clears the cart. See [order placement](../domain/order-placement.md) for retry and concurrency limits.

## Verification and future replacement

- [Repository contracts](../../tests/contracts), [composed lifecycle](../../tests/integration/purchase-lifecycle.test.ts) and feature interactions cover success, ownership, cancellation, validation and persistence failures.
- [Business-risk matrix](../testing/test-matrix.md) maps the required rules to actual test sources; [progress](../implementation-progress.md) records executed evidence.
- [DRF migration handoff](migration.md) defines proposed endpoint/DTO mappings, security decisions, contract-evolution constraints and the backend acceptance harness. Real backend implementation and transport tests remain separate work.

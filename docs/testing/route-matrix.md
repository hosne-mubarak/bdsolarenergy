# Route and recovery matrix

This inventory follows approved plan section 8 and the route factory in `src/app/router/routes.ts`. P means public, G means guest-only, and A means a restored demo session is required. Public cart and wishlist resolve the current guest or customer inside their repositories. Authenticated pages resolve ownership inside adapters as well as using route guards.

The table maps implemented test sources; it does not claim that every route has been visited in every browser. Actual execution results belong in [implementation progress](../implementation-progress.md). The route inventory suite checks all 42 concrete route/access examples and loads their screen modules, which proves wiring rather than a complete user journey.

| Approved route                             | Access | Screen             | Relevant test sources                                                                |
| ------------------------------------------ | ------ | ------------------ | ------------------------------------------------------------------------------------ |
| `/`                                        | P      | HomePage           | home, router inventory, foundation browser                                           |
| `/products`                                | P      | CataloguePage      | catalogue, router inventory, catalogue browser                                       |
| `/category/:categorySlug`                  | P      | CataloguePage      | catalogue, catalogue domain, router inventory                                        |
| `/category/:categorySlug/:subcategorySlug` | P      | CataloguePage      | catalogue, catalogue domain, router inventory                                        |
| `/search?q=`                               | P      | CataloguePage      | search, catalogue domain, router inventory, catalogue browser                        |
| `/featured`                                | P      | CataloguePage      | catalogue, router inventory                                                          |
| `/best-sellers`                            | P      | CataloguePage      | catalogue, router inventory                                                          |
| `/new-arrivals`                            | P      | CataloguePage      | catalogue, router inventory                                                          |
| `/offers`                                  | P      | CataloguePage      | catalogue, router inventory                                                          |
| `/product/:slug`                           | P      | ProductDetailPage  | product details, router inventory, catalogue browser                                 |
| `/cart`                                    | P      | CartPage           | cart page, cart contracts, guard interactions, router inventory, shopping browser    |
| `/wishlist`                                | P      | WishlistPage       | wishlist, wishlist contracts, guard interactions, router inventory, shopping browser |
| `/checkout`                                | A      | CheckoutPage       | checkout, placement, quote/order contracts, router inventory                         |
| `/order-confirmation/:orderId`             | A      | ConfirmationPage   | confirmation, owned-order read contracts, router inventory                           |
| `/login`                                   | G      | LoginPage          | login, guards, auth contracts, router inventory, auth browser                        |
| `/register`                                | G      | RegistrationPage   | registration, auth contracts, router inventory, auth browser                         |
| `/forgot-password`                         | G      | ForgotPasswordPage | recovery, auth lifecycle contracts, router inventory, auth browser                   |
| `/reset-password`                          | G      | ResetPasswordPage  | recovery, auth lifecycle contracts, router inventory, auth browser                   |
| `/verify-email`                            | P      | VerificationPage   | recovery, auth lifecycle contracts, router inventory                                 |
| `/logout`                                  | A      | LogoutPage         | guards, auth contracts, router inventory, auth browser                               |
| `/unauthorized`                            | P      | UnauthorizedPage   | router inventory                                                                     |
| `/account`                                 | A      | DashboardPage      | account, guards, order history, router inventory                                     |
| `/account/profile`                         | A      | ProfilePage        | account, profile contracts, guards, router inventory                                 |
| `/account/profile/edit`                    | A      | ProfileEditPage    | account, profile contracts, router inventory                                         |
| `/account/password`                        | A      | ChangePasswordPage | recovery, auth lifecycle contracts, router inventory                                 |
| `/account/addresses`                       | A      | AddressBookPage    | addresses, address contracts, router inventory                                       |
| `/account/addresses/new`                   | A      | AddressEditorPage  | addresses, address contracts, router inventory                                       |
| `/account/addresses/:addressId/edit`       | A      | AddressEditorPage  | addresses, address contracts, router inventory                                       |
| `/account/orders`                          | A      | HistoryPage        | order history, order-history contracts, router inventory                             |
| `/account/orders/:orderId`                 | A      | OrderDetailPage    | order history, owned-order read/history contracts, router inventory                  |
| `/account/orders/:orderId/tracking`        | A      | TrackingPage       | order history, order-history contracts, router inventory                             |
| `/account/wishlist`                        | A      | WishlistPage       | wishlist, guards, router inventory                                                   |
| `/account/settings`                        | A      | SettingsPage       | settings, preferences contracts, router inventory                                    |
| `/about`                                   | P      | ContentPage        | content, fixture/read contracts, router inventory                                    |
| `/contact`                                 | P      | ContactPage        | contact, router inventory                                                            |
| `/faq`                                     | P      | ContentPage        | content, router inventory                                                            |
| `/shipping-delivery`                       | P      | ContentPage        | content, fixture/read contracts, router inventory                                    |
| `/returns-refunds`                         | P      | ContentPage        | content, router inventory                                                            |
| `/warranty`                                | P      | ContentPage        | content, product details, router inventory                                           |
| `/privacy`                                 | P      | ContentPage        | content, router inventory                                                            |
| `/terms`                                   | P      | ContentPage        | content, router inventory                                                            |
| `*`                                        | P      | NotFoundPage       | router, router inventory                                                             |

## Test source index

- **router**: `src/app/router/router.test.tsx`; **router inventory**: `src/app/router/route-inventory.test.tsx`.
- **home**: `src/features/home/home.test.tsx`; **catalogue**: `src/features/products/catalogue.test.tsx`; **catalogue domain**: `src/domain/catalogue/query.test.ts`; **search**: `src/features/search/search.test.tsx`; **product details**: `src/features/products/details.test.tsx`.
- **cart page**: `src/features/cart/cart-page.test.tsx`; **wishlist**: `src/features/wishlist/wishlist.test.tsx`; shopping repository tests are `tests/contracts/cart.test.ts` and `tests/contracts/wishlist.test.ts`.
- **login**, **registration**, **recovery** and **guards**: corresponding test files in `src/features/auth`. Auth contracts are `tests/contracts/auth.test.ts` and `tests/contracts/auth-lifecycle.test.ts`.
- **account**, **addresses**, **settings**: corresponding test files in `src/features/account`; profile/address/preferences repository contracts are in `tests/contracts`.
- **checkout** and **placement**: corresponding test files in `src/features/checkout`; quote and transactional placement contracts are `tests/contracts/quotes.test.ts` and `tests/contracts/orders.test.ts`.
- **confirmation** and **order history**: `src/features/orders/confirmation.test.tsx` and `src/features/orders/history.test.tsx`; owned-order read/history contracts are `tests/contracts/orders-read.test.ts` and `tests/contracts/order-history.test.ts`.
- **content** and **contact**: corresponding test files in `src/features/content`; fixture/read tests are `src/data/fixtures.test.ts` and `tests/contracts/json-reads.test.ts`.
- **browser**: named specification files in `tests/e2e`. Playwright projects run desktop Chromium and mobile Chromium; source presence is not evidence of execution on other browser engines.

## Recovery boundaries

| Condition                                           | Implemented response                                                                                   | Test boundary                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Initial route or repository read                    | Visible loading status; shared shell remains available when feature reads fail                         | Router/provider, feature interaction and feedback tests                                |
| Missing product/category or invalid category parent | Repository/domain not-found error; no product results masquerading as success; retry and home recovery | Catalogue domain/interactions and router inventory                                     |
| Unknown/foreign address or order                    | Owned adapter returns a nondisclosing not-found result; editor/snapshot is not rendered                | Address/order contracts and interactions; missing-ID router inventory                  |
| Empty search/cart/wishlist/history                  | Distinct empty message and useful catalogue navigation                                                 | Feature interactions and router inventory                                              |
| Transient read failure                              | Normalized safe message, contextual retry, successful data rendering after recovery                    | Feature injection tests and router inventory                                           |
| Storage unavailable                                 | Public catalogue remains readable; cart becomes unavailable rather than a false zero/empty state       | Persistence contracts and router inventory                                             |
| Newer persisted schema version                      | Read conflict preserves data; public footer offers explicitly confirmed namespace reset                | Persistence version contracts; reset/settings interactions and TASK-035 recovery audit |
| Cancelled read                                      | Abort remains cancellation; it is not normalized into a user-visible retry failure or mutation success | Repository cancellation contracts                                                      |
| Failed mutation/storage write                       | Error remains visible, form/cart is retained where applicable; success is not claimed                  | Profile/address/auth/quote/order/reset failure tests                                   |
| Session restoration/expiry/switch/logout            | Restore gate, safe original URL, private-query cleanup and owner-scoped caches                         | Provider/guard/auth contracts and auth browser journeys                                |
| Unknown public/account path                         | Shared page-not-found screen with home recovery; account group retains authentication boundary         | Router and router inventory                                                            |

The reset action is available in both settings and the public footer, including when an incompatible saved session prevents account access. It requires confirmation, preserves unrelated browser keys, clears both local and tab application namespaces, and reports partial storage-removal failures. Source inspection establishes placement of this recovery control; the progress tracker records which interaction/fault cases actually executed.

## Remaining release evidence

As of TASK-035, route wiring, adapter contracts and targeted feature interactions exist. The final responsive/keyboard/contrast/accessibility audit belongs to TASK-036, consolidated full checks to TASK-037, complete browser purchase/account journeys and additional browser-engine findings to TASK-038, and production-preview deep-link fallback verification to TASK-039. Do not infer these results from route inventory checks or an earlier successful development build. A live backend, merchant processing, payment capture and real delivery are outside this frontend demonstration.

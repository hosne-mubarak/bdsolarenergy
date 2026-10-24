# Architecture decisions

TASK-001 establishes the implementation defaults for the [approved plan](../DEVELOPMENT_PLAN.md). The user's implementation instruction authorizes development in backlog order. These decisions elaborate that plan; they do not authorize production deployment or invent a backend contract.

## 1. Scope and delivery

Build the JSON-backed React storefront incrementally. English is the initial UI language; accept Unicode names and addresses. Bangladesh delivery and BDT are the initial market. Login is required for checkout and owned order history; guests can browse, save a cart and use a wishlist. Reviews are read-only. A management area, Django backend, real payments, messages and shipments are outside this implementation.

Complete one backlog task and its acceptance checks before starting the next eligible task. Track work in `docs/implementation-progress.md`. Do not commit, push or deploy unless the user authorizes that action. The initial plan-only restrictions describe the previous phase; the new implementation request authorizes the tasks without changing their dependencies.

## 2. Dependency boundaries

The allowed flow is page/component → feature hook → repository contract → adapter → validated fixture or persistence. Hooks may call pure domain functions. Domain modules and schemas must not import React, routing, browser storage or transport code.

- `src/app`: route composition, providers and layouts. Select adapters once in `services/container.ts`, not per component.
- `src/features`: feature hooks, pages and feature-only components. Expose cross-feature functionality through explicit public exports.
- `src/components`: stable shared UI responsibilities. Receive typed props or call feature hooks; never import fixtures, fetch directly or access storage.
- `src/domain`: deterministic business rules, including calculations, catalogue rules and state transitions.
- `src/services/contracts`: asynchronous interfaces and normalized errors. No React or concrete-adapter imports.
- `src/services/json`: fixture access and simulated mutation orchestration. Validate fixture input and protect shared fixture objects from mutation.
- `src/services/persistence`: all browser storage reads/writes, migrations and recovery.
- `src/services/http` and future `api`: HTTP transport, DTO mapping, headers, cancellation and error normalization. Create only when required.
- `src/types` and `src/schemas`: domain entities, input shapes and runtime checks. Shared schemas must not depend on UI.

Create directories when there is functionality to put in them. Avoid an unused abstraction or second state store. A future DRF adapter must satisfy the same feature-facing contract; API failure must not silently select fixtures.

## 3. Data conventions

Use TypeScript strict mode. Types/interfaces use PascalCase; functions/variables use camelCase; React components use PascalCase filenames; hooks use `use` prefixes. JSON/docs filenames use kebab-case. Prefer named exports except where router lazy-module conventions require otherwise. Choose descriptive entity-specific IDs, never array positions, as keys.

Business records belong in structured fixtures, including catalogue, store contacts, configured collections, shipping, payment choices and policy content. Generic UI action labels may live in presentation code; a product name, price, discount or store fact may not. Validate fixture IDs, slugs, SKU uniqueness, references and category acyclicity. Keep product/variant relationships separate from line quantities.

Store all monetary amounts as nonnegative safe integer poisha. `100` poisha is `৳1`. Never calculate totals using formatted text or floating-point taka. Reject overflow/invalid quantities. Format through a shared `Intl.NumberFormat` utility with BDT. Keep format locale centralized; Unicode-safe input does not require Bangla translations in the first release.

Use UTC ISO-8601 timestamps for stored data. Inject a clock and ID generator into time-sensitive services for deterministic tests. Dates displayed to customers use an explicitly selected locale/timezone (`Asia/Dhaka` initially); date-only policy text must not shift through timezone conversion. Use stable string IDs and unique URL-safe slugs; relationships store IDs rather than repeated live objects. Purchase snapshots intentionally copy immutable names/prices/addresses.

## 4. State and persistence

TanStack Query owns cached repository reads and mutation feedback. Query keys include normalized catalogue parameters and user ID for private data. Repositories own persisted entities, not a duplicate React context store. Keep filters/sort/page in URL parameters, form state in React Hook Form and transient menus/dialogs in component state. The auth provider exposes restored identity/session status without owning a second account data cache.

Read-only JSON is the catalogue baseline. Mutable cart, wishlist, demo identities/profile/address/preferences and orders use versioned namespaced envelopes: `{ version, updatedAt, data }`. Use a `bdsolarenergy:` key prefix and scope private aggregates to user IDs. Imported fixtures are never written back. Migrate known older versions; recover a corrupt aggregate only, with a visible explanation; unknown future versions require an explicit safe reset. Never remove unrelated browser keys.

Missing state seeds deterministic defaults. Storage errors are typed failures; they must not produce a false successful mutation. Observe storage events to invalidate affected queries. Reset requires confirmation. Resetting the demo clears only its own namespace, cancels affected queries and clears session/cache.

## 5. Demo authentication and privacy

Treat all browser-only identity checks as a demonstration. Never present route guards as secure authorization. Do not store/log plaintext passwords or include them in error telemetry. Seeded demo accounts use a documented public passphrase in configuration, never a stored user credential. Registration uses a salted Web Crypto verifier for comparisons, still fully browser-controlled and insecure against a determined user. Clear password fields after submission and on unmount.

Remembered sessions persist only identity ID and expiry in local storage; non-remembered sessions use session storage. Validate identity existence/expiry before guards render account pages. Logout cancels private queries, clears private cache/session and reveals the independent guest shopping state. Prevent foreign-order/address disclosure in the demo adapter and test user switching.

On login merge guest shopping data once, deduplicate IDs, clamp quantities to inventory/order limits and report reductions. Clear guest data only after a successful merge. Safe return paths must be internal app paths; reject protocol-relative and external destinations.

Recovery always gives a generic simulated response; no actual email is sent. Demo reset uses a clearly labeled expiring single-use local intent. Verification and tracking are similarly labeled simulations. Do not collect real payment credentials or sensitive personal information for testing.

## 6. Commerce defaults

Every product has a purchasable SKU, including a default variant. Store only SKU and quantity in the cart; resolve current prices from the repository. Stock/max-per-order rules apply in cart operations and again at checkout. Wishlist IDs refer to products, not quantities.

Calculation order is current line subtotal → eligible coupon discount → shipping → configured tax → total. Prices are tax-inclusive by default, with zero additional tax. Shipping free-delivery thresholds use discounted subtotal. Permit one coupon; do not stack. Compare-at price is display-only. Shipping-zone eligibility and minimum order are fixture-configured. Mobile financial services/card/COD methods are simulations, not integrations.

Quote on review and revalidate on submission. A price change requires explicit renewed review. Reject expired/ineligible coupons, unsupported delivery, empty carts and invalid stock. Do not trust UI totals. Freeze order item/address/price/totals snapshots. Persist the idempotency key across retries and return the original order on repeated submission.

Commit order, reservation ledger and cart change in a single versioned local checkout aggregate before confirming success. Revision checks expose local contention without silent overwrite. This models a transaction, but cannot guarantee inventory across tabs/devices; true atomicity belongs to the backend. A failed persistence write must retain a recoverable cart and must not show confirmation.

## 7. UI, accessibility and error conventions

Use the plan's navy/green/yellow palette with verified AA contrast and a consistent 4px spacing scale. Prefer native controls. Inputs have visible labels and linked error text; icon-only actions have accessible names. Dialogs restore focus; keyboard focus is visible; feedback has appropriate live announcements. Do not use color alone for status. Respect reduced motion and test 360/768/1440px and 200% zoom.

Repository errors use `validation`, `not_found`, `conflict`, `unauthenticated`, `forbidden`, `storage_unavailable` or `unavailable`, with safe messages and optional field errors. Pages distinguish loading, error, empty and successful content. Retry transient reads only with bounded behavior; do not automatically retry non-idempotent writes. Abort obsolete reads. Unknown slugs/IDs have contextual recovery, not a blank screen.

## 8. Testing and change review

Schemas/fixtures, domain rules and repository contracts receive focused tests. RTL tests observable behavior, forms and guards; Playwright tests integrated journeys and reload persistence. Tests inject time/IDs and isolate storage. Do not rely on random fixtures, arbitrary sleeps or tests duplicating implementation internals.

After tooling exists, required checks are formatting, lint, strict types, executed unit/component/contract suites, production build and relevant browser journeys. Record exact commands, executed case counts and limitations in the progress document; never report unrun checks as passing. Documentation-only TASK-001 uses link/reference/consistency and whitespace review because no runnable application exists yet.

Each review describes its task ID, behavior, boundaries, changed files, evidence and outstanding risks. Preserve existing changes; never reset unrelated work. Commit lockfile updates with dependency changes only when commits are authorized. Do not change architecture or add dependencies without explaining the need against the approved plan.

## 9. Configuration and future API boundary

Pin a supported Node LTS, resolve compatible stable package releases, record exact installed versions and maintain one npm lockfile in TASK-002. Initially support `VITE_DATA_SOURCE=json`; reject unsupported values explicitly when adapter composition is implemented. `VITE_API_BASE_URL` is reserved public future configuration, never a credential. Every Vite-exposed variable is public in the bundle.

DRF URLs/DTOs in the plan remain proposed. Backend work must agree pagination, errors, money units, cancellation, ownership, idempotency and session handling before enabling API mode. Prefer secure HttpOnly cookie sessions where suitable; backend must define CSRF/CORS. Token renewal/revocation and storage are unresolved if token sessions are selected. Never invent working API endpoints or client-side security guarantees.

## 10. Owner decisions and default resolution

| Decision                       | Development default                                          | Required before production                                 |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Branding/store identity        | Clearly marked sample contacts/assets                        | Owner-approved brand and contact details                   |
| Product facts/pricing/warranty | Validated sample fixtures and licensed images                | Approved catalogue, inventory and warranty claims          |
| Payment/shipping/minimums      | Fixture rules, simulated payment, Bangladesh only            | Merchant providers, zones, fees and commercial terms       |
| Tax and policies               | Tax-inclusive BDT, zero additional tax, draft policy content | Owner/legal approval of taxes and all policies             |
| Auth/privacy/retention         | Browser demo, no production secrets                          | Server security and data-retention policy                  |
| Inventory/concurrency          | Local reservation aggregate and visible conflicts            | Server atomic inventory/order/payment operations           |
| Persistence limitations        | Recoverable quota/privacy errors and namespace reset         | Any server-backed guest persistence requirement            |
| Localization                   | English, Unicode-safe inputs, BDT and Dhaka display timezone | Bangla translations and localized search requirements      |
| API transport/auth             | Interfaces only; no real backend availability required       | Agreed DRF contract, session/CSRF/CORS design              |
| Hosting/performance            | Vite static output; document SPA fallback                    | Host/domain, approved budgets and deployment authorization |
| Administration                 | Excluded                                                     | Separate backend-enforced staff application scope          |

These pending production decisions do not block the explicitly labeled local demo. Record new decisions here rather than silently changing the defaults.

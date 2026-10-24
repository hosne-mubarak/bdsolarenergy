# bdsolarenergy.com

A React and TypeScript e-commerce frontend for solar and electrical equipment in Bangladesh. The application runs entirely from validated JSON fixtures and browser-side demo persistence, with typed repository interfaces for a future Django REST Framework adapter.

The implemented journey covers catalogue search/filter/sort/pagination, variant details, cart and wishlist, demo registration/sign-in/recovery, customer profiles and addresses, preferences/reset, delivery/coupons/simulated payment, order confirmation/history/tracking, information pages and a local contact-form preview. No backend, real payment, merchant order, email delivery or shipment is created. Store contacts, product claims and policies are illustrative and need owner review before real publication.

[Implementation progress](docs/implementation-progress.md) records the actual status of all 40 tasks, validation results and remaining limits. The [approved plan](docs/DEVELOPMENT_PLAN.md) remains the requirements source.

## Run locally

Use Node **24.19.0** and npm **11.9.0**. `.nvmrc` pins the tested Node version, and `package.json` enforces the supported Node 24/npm 11 range. If nvm is installed, run `nvm use` from this directory. Dependencies are pinned in `package-lock.json`; the ignored npm cache is inside `.cache/npm`.

```sh
npm ci
npm run dev
```

Vite serves development on port 5173 by default. No API, database, credential service or environment file is required.

Use the intentionally public demo account `demo@example.com` with passphrase `SolarDemo123!`, or register an invented local account. `another@example.com` uses the same public passphrase for account-isolation demonstrations. Use sample personal details and a password you do not use elsewhere. Browser-controlled accounts and route guards are demonstrations, not production authentication.

Cart, wishlist, local account data and orders persist in this browser under the `bdsolarenergy:` namespace. Remembered sessions last seven days; tab sessions last one day and use session storage. Data belongs to the current origin, so a different host or port has separate demo data. Logout reveals the separate guest cart. **Reset demo data** in settings or the public footer requires confirmation and removes all of this application's demo data in both browser stores, while preserving unrelated keys.

## Configuration

Optional public build-time values are shown in [.env.example](.env.example):

| Variable            | Current behavior                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_DATA_SOURCE`  | Omitted defaults to `json`. Only `json` is implemented; unsupported or empty modes fail explicitly. |
| `VITE_API_BASE_URL` | Reserved and currently unused. Setting it does not enable an API adapter.                           |

Restart Vite after changing development environment values, or rebuild the static output. Vite-prefixed values must be treated as public browser configuration; never put credentials, private keys or server secrets in them. Editing an environment file after publishing a static bundle does not reconfigure that bundle.

## Quality checks

```sh
npm run format:check
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

`npm run format` applies formatting. Vitest covers domain rules, schemas, repository contracts, interactions and service integration. The [test matrix](docs/testing/test-matrix.md) maps business risks to actual suites, and the [route matrix](docs/testing/route-matrix.md) maps all 42 approved path/access examples.

Install Playwright's matching Chromium and system dependencies before the first browser run:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

The default browser suite runs desktop Chromium and Pixel 7 emulation, starts Vite on port 4173 and retains failure traces/screenshots. On managed machines with system Chromium, use:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Run one Playwright process at a time when using the default report/artifact directories. [Browser journey evidence](docs/testing/browser-journeys.md) records the successful 38-case Chromium run and exact commands for the optional Firefox/WebKit projects. Both additional browser downloads were blocked in this environment by HTTP 403 `Domain forbidden`; they have no passing execution claim and remain a pre-release check. The Chromium executable override applies only to Chromium projects.

[Accessibility evidence](docs/testing/accessibility.md) records actual keyboard purchase, responsive/CSS-zoom checks, axe results and manual-review limits; [contrast evidence](docs/testing/contrast.md) records tested color pairs. These do not claim physical-device, screen-reader or universal WCAG certification.

The [CI workflow](.github/workflows/ci.yml) is configured for frozen install, formatting, lint, types, Vitest, build and Chromium journeys. Local passing checks are reported separately from any remote CI result. Generated build, cache and Playwright reports are ignored.

## Static build and hosting

```sh
npm run build
npm run preview -- --port 4176 --strictPort
```

The build creates `dist`. Preview is a local production-build smoke server, not a deployment. Static hosting needs an SPA fallback for application routes so direct product/account URLs load the entry document. Missing asset paths must still return asset errors. See [static SPA hosting](docs/hosting/static-spa.md) for fallback/cache examples, public environment semantics and the production verification checklist. The [production verification](docs/testing/production.md) and [performance review](docs/testing/performance.md) distinguish actual checks from remaining limits. No deployment has been performed.

## Source layout and migration boundary

| Location                                                            | Responsibility                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app`                                                           | Route composition, providers and shared layout                        |
| `src/features`                                                      | Pages, feature hooks and local interaction state                      |
| `src/components`, `src/styles`                                      | Accessible shared presentation and responsive design                  |
| `src/domain`                                                        | Pure catalogue, quantity, integer-poisha, coupon and delivery rules   |
| `src/types`, `src/schemas`                                          | Shared contracts and runtime validation                               |
| `src/services/contracts`                                            | Feature-facing asynchronous repository interfaces                     |
| `src/services/json`, `src/services/persistence`                     | JSON adapters, owned demo mutations and versioned browser persistence |
| `src/data`, `public/images`                                         | Validated sample fixtures and local original illustrations            |
| `tests/contracts`, `tests/unit`, `tests/integration`, feature tests | Behavioral checks below the browser boundary                          |
| `tests/e2e`                                                         | Full browser journeys, recovery and accessibility checks              |

UI code does not fetch data, read browser storage or import fixture JSON directly. Hooks call repository contracts; adapters resolve ownership and normalize errors. Current order placement requotes and commits the order snapshot, cart clear and local stock reservations in one versioned aggregate, retaining an idempotency key for retries. Browser storage cannot guarantee cross-device or independently executing cross-tab inventory transactions.

Future DRF integration must replace infrastructure adapters and enforce authentication, ownership, inventory, payment verification and idempotency on the server. It must agree DTOs, pagination, money units, cancellation and cookie/CSRF/CORS behavior before enabling API mode. See [repository contracts](docs/api/repositories.md), [architecture decisions](docs/architecture/decisions.md), [demo authentication limits](docs/auth/demo-authentication.md) and [contribution conventions](CONTRIBUTING.md).

See the [final frontend acceptance checklist](docs/final-acceptance.md) for implemented scope, actual validation and remaining release gates.

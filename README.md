# bdsolarenergy.com

React storefront for solar and electrical equipment in Bangladesh, being implemented incrementally from the [approved development plan](docs/DEVELOPMENT_PLAN.md).

The application supports a complete browser-only demo shopping journey, including catalogue search, cart, wishlist, demo accounts, address management, checkout and persisted orders. TASK-001–036 are verified; final test consolidation, browser journeys and production/DRF handoff remain TASK-037–040. No real payment, merchant order or delivery is created. See [implementation progress](docs/implementation-progress.md) for verified task status and [architecture decisions](docs/architecture/decisions.md) for data, security and implementation conventions.

## Setup and development

Use Node **24.19.0** (`nvm use` with nvm installed) and npm **11.9.0**. `package.json` enforces the supported Node 24/npm 11 range; `.nvmrc` pins the tested runtime. The npm cache lives in ignored `.cache/npm` so cloud tasks do not need to write outside this checkout.

From the repository root:

```sh
npm ci
npm run dev
npm run lint
npm run format:check
npm run typecheck
npm run test -- --run
npm run test:e2e
npm run build
npm run preview
```

The development server uses port 5173 by default. The demo requires no API, database or environment file. Use the public demo account `demo@example.com` with passphrase `SolarDemo123!`, or register an invented local account. Never reuse a real password. `VITE_DATA_SOURCE=json` selects the implemented fixture adapters; unsupported modes fail explicitly. Future `VITE_API_BASE_URL` is public configuration and must never contain a secret.

Unit/component tests use Vitest with jsdom. Browser journey and accessibility tests start their own Vite server on port 4173 and run Chromium desktop/mobile configurations. Install the matching Playwright browser before the first run:

```sh
npx playwright install chromium
npm run test:e2e
```

On a managed cloud machine with system Chromium, use the supported executable override instead of downloading a browser:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

CI installs browser system dependencies using `npx playwright install --with-deps chromium`. The normal application does not need this environment variable. Generated reports, cache and build output are ignored. See [tested toolchain](docs/architecture/toolchain.md) for exact resolved versions and compatibility decisions.

## Project layout

- `src/app`: routing, shared layout and application providers.
- `src/styles`, `src/components`: responsive presentation and accessible shared controls.
- `src/features`: catalogue, shopping, authentication, account, checkout, orders and content screens.
- `src/domain`: pure catalogue, money, cart, coupon and delivery rules.
- `src/services`: typed contracts, JSON adapters and versioned browser persistence.
- `src/data`: validated sample fixtures.
- `tests/contracts`, `tests/unit`, feature tests and `tests/e2e`: repository, domain, interaction and browser verification.
- `docs`: approved plan, decisions and task progress.
- `.github/workflows/ci.yml`: install, format, lint, types, unit tests, build and browser checks.

For static hosting, serve `dist` with an SPA fallback to `index.html` for application routes. Final production-preview and reproducibility evidence belongs to TASK-039; no deployment has been performed.

## Design boundaries

- JSON fixtures provide catalogue data; typed repositories isolate data access.
- Browser persistence simulates carts, wishlists, accounts, addresses, and orders.
- Authentication, email workflows, order tracking, and payments are demonstrations, not production services.
- Future Django REST Framework adapters must preserve feature-facing repository contracts.
- No backend or live merchant integrations are included in this phase.

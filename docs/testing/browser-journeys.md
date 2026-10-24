# Browser journey verification

TASK-038 extends the functional and accessibility suites into complete shopping and customer-account journeys. These are local Playwright results against the Vite development server, not production deployment, live merchant processing or remote CI results. Production-preview evidence belongs to TASK-039.

## Configured coverage

The default configuration runs Chromium desktop and Pixel 7 mobile emulation. Each test receives a fresh browser context with separate local and tab storage. Nineteen named cases across eight specification files produce 38 default project cases.

| Specification                                                  | Named cases per project | Behavioral evidence                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [foundation](../../tests/e2e/foundation.spec.ts)               |                       2 | Styled entry, demo disclosure, reload, page errors, narrow layout, keyboard-operable mobile navigation and focus return                                                                                                                                                                                                            |
| [catalogue](../../tests/e2e/catalogue.spec.ts)                 |                       2 | Filter/sort URL state, reload/back navigation, SKU search, variant-specific SKU/price and quantity                                                                                                                                                                                                                                 |
| [shopping](../../tests/e2e/shopping.spec.ts)                   |                       1 | Cart and wishlist persistence, current prices, coupon discount and saved-product removal                                                                                                                                                                                                                                           |
| [auth](../../tests/e2e/auth.spec.ts)                           |                       2 | Protected return path, guest cart/wishlist merge, logout isolation, registration, local recovery and no-email notices                                                                                                                                                                                                              |
| [purchase](../../tests/e2e/purchase.spec.ts)                   |                       2 | Search/filter/variant/cart/login/new address/coupon/mobile-payment simulation/confirmation/history/tracking; invalid coupon preserves draft; double activation creates one history record; saved address supports outside-Dhaka delivery and card simulation without credential fields                                             |
| [account](../../tests/e2e/account.spec.ts)                     |                       3 | Registration validation and password visibility; profile edits/reload; address add/edit/default/delete-cancel/delete-confirm/fallback; preference persistence; second-user and foreign-address isolation; normalized duplicate email; remembered-session expiry and safe destination restoration without losing saved cart/address |
| [checkout recovery](../../tests/e2e/checkout-recovery.spec.ts) |                       4 | Failed aggregate write preserves cart and retry key; retry creates one order; foreign confirmation denied; changed cart requires re-review; reserved stock prevents overselling; empty search and unknown product/route recovery                                                                                                   |
| [accessibility](../../tests/e2e/accessibility.spec.ts)         |                       3 | Actual keyboard-only purchase, axe scans, viewport/200% CSS zoom/long-name/extreme-amount layout checks, native FAQ keys, modal focus trapping/Escape and valid review-rating semantics                                                                                                                                            |

The section 14 price-change case is also covered by [transaction contracts](../../tests/contracts/orders.test.ts). Browser recovery exercises changed cart and stock after review without adding a production-only mechanism for changing the static catalogue price. Zero real payment or account credentials are collected by checkout; seeded account passphrases are intentionally public demo access.

## Deterministic inputs and failure fixtures

Names, email addresses, products, coupon codes and addresses used as test inputs are fixed synthetic data. Normal application-generated IDs identify the records created during a journey; they are read from the resulting UI or stored record rather than guessed. Assertions wait for observable headings, navigation, checked controls, errors, totals, counts or persisted results. There are no arbitrary sleeps.

Deliberate browser fault fixtures are isolated to their test context:

- The write-failure case replaces `Storage.prototype.setItem` only for the checkout aggregate, verifies zero orders and the retained cart, then restores the method and retries with the same persisted attempt key.
- Changed-cart and reserved-stock cases update a valid versioned checkout envelope and increment its revision after review. They assert rejection and no successful order before recovery.
- The session-expiry case backdates only the remembered session expiry, reloads a protected URL, and signs in again through the normal UI. The saved address and account cart must reappear for their owner.
- Accessibility reflow uses an isolated high-value order snapshot to stress long monetary text. This changes no production fixture, rule or feature.

These fixtures test failure handling; they are not customer controls or evidence of backend guarantees. Browser-side storage remains editable by someone controlling the browser, and local revision checks cannot provide cross-device inventory transactions.

## Execution and artifacts

The final centralized default-project run passed all **38 cases** in **2.0 minutes**, using two workers against system Chromium. There were no failed, retried, skipped or expected-failure cases in this run. The preceding centralized run passed 36/38: two catalogue cases used an immediate native-checkbox assertion while the controlled state followed asynchronous URL navigation. Waiting for the checked state and sort URL fixed the test readiness assumption; the full suite was then rerun successfully. The progress tracker remains the task status authority.

Initial independent runs shared the same `test-results` artifact directory. Several cases reached their final UI assertions but failed during `browserContext.close` with missing trace/network artifact files after another runner cleaned that directory. Those cases are not counted as passes. Verification was consolidated into one Playwright process against a persistent external development server to remove artifact-directory and server-lifetime contention. The final centralized result supersedes these interrupted runs once recorded.

Playwright keeps traces and screenshots on failure, with its HTML report under ignored `playwright-report` and artifacts under ignored `test-results`. [Accessibility evidence](accessibility.md) separately records axe findings and incomplete rules; it does not infer assistive-technology or physical-device certification.

Reproduce the default suite with the pinned dependencies and matching browser:

```sh
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

On a managed environment with system Chromium:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Run one Playwright command at a time when using the default shared artifact/report directories. The configuration starts its own server when needed and permits reuse outside CI. A persistent external Vite server is useful for coordinated local verification; CI starts a fresh server.

## Additional browser engines and release gate

`PLAYWRIGHT_ALL_BROWSERS=1` adds desktop Firefox and WebKit projects. The system Chromium executable override applies only to the two Chromium projects, so it cannot accidentally substitute Chromium for another engine.

Official installation was attempted for Firefox build v1555 and WebKit build v2370 on the available Debian 13 environment. Both browser downloads were blocked by HTTP 403 responses with the body `Domain forbidden`. WebKit's official download named version 27.2 and `webkit-debian-13.zip`. No application/browser test ran in either unavailable engine. These are documented environment blockers, not passing checks, skipped test cases or observed application incompatibilities.

Retry from an environment permitted to fetch the official browser packages, using a workspace-local cache if required:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npx playwright install --with-deps chromium firefox webkit
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" PLAYWRIGHT_ALL_BROWSERS=1 npm run test:e2e
```

A targeted cross-engine run is also possible after installation:

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" PLAYWRIGHT_ALL_BROWSERS=1 npm run test:e2e -- --project=firefox --project=webkit
```

Firefox/WebKit execution and triage remain a pre-release gate. Their absence does not invalidate observed Chromium results, but Chromium desktop/mobile emulation cannot establish Safari, Firefox, real mobile hardware or production-host compatibility. The final handoff must retain this limitation until the additional projects actually execute and pass.

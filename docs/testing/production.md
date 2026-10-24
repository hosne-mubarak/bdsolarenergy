# Production build verification

TASK-039 verifies static demo output locally. No hosting, domain change, deployment or live merchant integration is included.

## Isolated reproduction

A fresh source copy was created without Git metadata, installed dependencies, caches, build output, reports, environment secrets or TypeScript build metadata. Only `.env.example` may be copied. Node 24.19.0 and npm 11.9.0 executed a frozen `npm ci`: 265 packages installed successfully. The source and lockfile are synchronized before the remaining checks; dependencies are not copied from the working checkout.

The final code/configuration was synchronized into the isolated copy with its unchanged lockfile (SHA-256 `b6c0a84a55fe1ce86040eeac0299f344afdffb0ddead450334e3617ec2d3f516`). Formatting, lint, strict TypeScript, **461 tests across 58 files**, and production build all passed there. No test failures, skips or expected failures were reported. The build emitted no large-chunk warning. This is a local clean-install result, not a remote CI claim.

At TASK-040, the final provider-injection source was synchronized into the same isolated checkout with unchanged frozen dependencies. Formatting, lint, strict types, **465 tests across 59 files** and the production build passed again. The final built-preview smoke also passed with zero page errors. A scan of 52 built JavaScript/HTML/CSS assets found no private-key/token patterns. This pattern check is scoped evidence, not a universal secret-detection guarantee.

## Production preview

The isolated build was served with `npm run preview -- --host 127.0.0.1 --port 4176 --strictPort`. A fresh system-Chromium context completed the following checks against built output:

- Direct product deep link returned HTTP 200, rendered the real product and loaded its local image.
- Protected account deep link preserved the original path/query, then sign-in and page reload restored the owned profile.
- Checkout validated a new address, reviewed the expected ৳18,580 total, placed one demo order, reloaded its confirmation and found its reference in order history.
- FAQ and unknown application routes rendered their content and page-not-found recovery.
- The hashed entry script returned HTTP 200 with a JavaScript content type. No browser page errors occurred.

A deliberately absent `/assets/absent-build-chunk.js` returned HTTP 200 with HTML under Vite preview's generic SPA fallback. This is an observed preview-server limitation, not an asset-404 pass. The provided production-host examples exclude asset and future API paths from fallback; those host configurations still require validation on the selected real host.

Vite preview is verification tooling. Production hosts need the [documented SPA fallback and static asset rules](../hosting/static-spa.md); this local result cannot verify an unspecified hosting provider.

## Build review

Bundle, image and representative mobile Lighthouse findings are recorded in [performance.md](performance.md). Vite variables are public build-time configuration. The JSON demonstration needs no backend credentials; `.env.example` documents the implemented source and reserved future API URL. No real payment or private API key belongs in a frontend bundle.

The additional Firefox/WebKit engine gate remains documented in [browser-journeys.md](browser-journeys.md), following blocked official downloads. A working production preview and Chromium test do not imply a cross-engine or live-production pass.

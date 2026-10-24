# Production bundle and mobile performance review

TASK-039 measured an actual Vite production build served by `vite preview` on localhost. This is a local demo handoff, not a deployment, remote CI result, physical-device benchmark or production performance guarantee. The machine-readable evidence is [performance-summary.json](performance-summary.json).

## Bundle and image review

The default build originally emitted a 520,511-byte entry chunk and Vite's 500 kB warning. The build now uses the supported Vite 8/Rolldown `output.codeSplitting.groups` option to separate React/router/scheduler and TanStack Query modules. The warning threshold was not raised. Grouping is restricted to these libraries rather than combining every dependency, which could make deferred account/form code eager.

| Measurement                                         |      Before |       After | Interpretation                                                             |
| --------------------------------------------------- | ----------: | ----------: | -------------------------------------------------------------------------- |
| Entry JavaScript, minified bytes                    |     520,511 |     208,480 | Smaller entry and independently cacheable library chunks                   |
| Largest JavaScript chunk                            |     520,511 |     313,938 | No chunk exceeds Vite's default 500 kB warning threshold                   |
| Static initial JS + CSS graph, raw bytes            |     599,726 |     599,031 | Almost unchanged overall; chunking is not a large total-download reduction |
| Static initial JS + CSS graph, estimated gzip bytes |     166,573 |     165,522 | Node `zlib.gzipSync` default settings, summed per file                     |
| All eight original local SVG files                  | 5,611 bytes | 5,611 bytes | Largest file is `panels.svg`, 1,283 bytes; no image optimization needed    |

The static initial graph follows the `index.html` entry's manifest `imports` and CSS links, excluding dynamic imports. This is not the complete homepage transfer: its lazy screen and product components also load. Lighthouse observed the completed homepage at 183,256 transferred bytes (about 179 KiB), including headers and requested assets under preview's compression. Compression settings and caching at an actual host can differ; the Vite build's gzip estimates can also differ from the explicit Node estimate used above.

`dist/.vite/manifest.json` records the output graph. Every account, authentication, checkout and order screen remains a dynamic entry and is outside the entry's static import graph. Home is also a lazy route. System fonts avoid an external font request. Images retain fixture-defined width/height and descriptive sample-illustration alt text, with below-fold product imagery lazy-loaded. These lightweight SVGs are samples, not a sizing recommendation for future merchant photography.

For future growth, retain the default chunk warning and track the full initial graph and actual route transfer rather than only the entry file. Agree new photo, gallery and hosting budgets when real content is introduced.

## Layout shift investigation and correction

The first mobile Lighthouse run after chunk splitting scored 72 with CLS 0.747. An actual `PerformanceObserver` trace identified one shift: the hero's 24px top margin collapsed through the main container, and the short page-loading state let the footer paint in the viewport before loaded content moved it below the fold.

The correction is limited to content geometry: `.page-main` establishes a flow root, and a direct top-level page loading state reserves one small viewport height. Nested loading components remain compact. Real content is not hidden, route focus and accessible labels are retained, and the same production measurement was repeated after rebuilding. The final home and product runs both observed CLS 0.000.

## Actual mobile Lighthouse results

Lighthouse **13.5.0** ran against the production preview using system Chromium on 24 October 2026. Its default mobile simulation used a 412×823 viewport, device scale 1.75, simulated 150ms RTT/1,638.4 Kbps throughput and a 4× CPU slowdown. These are single local runs; shared-host activity and real devices/networks can change the timings.

| Metric                   | Home, after correction | Product details, after correction |
| ------------------------ | ---------------------: | --------------------------------: |
| Performance score        |                     94 |                                94 |
| First contentful paint   |                  2.12s |                             2.25s |
| Largest contentful paint |                  2.51s |                             2.48s |
| Total blocking time      |                143.5ms |                             149ms |
| Cumulative layout shift  |                  0.000 |                             0.000 |
| Speed index              |                  2.12s |                             2.25s |
| Total observed transfer  |          183,256 bytes |                     177,521 bytes |

No Lighthouse runtime error occurred. Approximately 45 KiB of unused framework JavaScript remained an advisory on the homepage. Home's high-priority hero image is requested after the client route loads, so Lighthouse also notes it is not discoverable in initial HTML; this is a client-rendered application. Account routes remain deferred. These diagnostics are recorded rather than suppressed or converted into an SEO/accessibility claim; those categories were not requested in these Lighthouse runs. Separate accessibility and browser evidence is linked from the progress tracker.

## Verification

The optimized production build passed without chunk-size warnings. Strict TypeScript, focused ESLint and formatting passed. The 32 contrast/navigation-focus tests passed, and the post-fix responsive/reflow/native-disclosure/dialog cases passed in both Chromium desktop and mobile projects (2 cases, 36.9s). Full clean-install and production deep-link checks are recorded separately in the TASK-039 handoff evidence.

## Reproduction

No Lighthouse runtime dependency or project lockfile change was introduced. `npm exec` uses an explicitly pinned analysis tool in the ignored npm cache.

```sh
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 4175 --strictPort
```

In a second terminal:

```sh
CHROME_PATH=/usr/bin/chromium npm exec --yes --package=lighthouse@13.5.0 -- lighthouse http://127.0.0.1:4175/ --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --only-categories=performance --output=json --output-path=/tmp/bdsolarenergy-lighthouse-home.json --quiet
CHROME_PATH=/usr/bin/chromium npm exec --yes --package=lighthouse@13.5.0 -- lighthouse http://127.0.0.1:4175/product/panels-550-1 --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --only-categories=performance --output=json --output-path=/tmp/bdsolarenergy-lighthouse-product.json --quiet
```

The Chrome flags apply to the isolated cloud analysis process; they are not production site settings. Use an appropriate Chromium path and sandbox configuration on another machine. Record actual host compression, immutable caching, SPA fallback and cold-route results before any deployment. Firefox/WebKit download blockers and physical-device/screen-reader limitations remain in their respective reports.

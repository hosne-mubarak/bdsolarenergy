# Accessibility and responsive verification

TASK-036 uses actual Chromium desktop and Pixel 7 emulation through Playwright. Browser results are local evidence, not remote CI or a deployment. The checked implementation remains a browser-only demonstration.

Reproduce with:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/accessibility.spec.ts
```

The suite contains a keyboard purchase with automated accessibility scans, responsive/reflow/dialog/disclosure checks, and a focused review-rating semantics regression in each project. All six cases were executed successfully across the full audit run and the subsequent focused follow-up described below.

## Scope and method

The purchase uses only Tab, Enter, Space, Home and typed keys after navigating to the starting product. It adds the default variant, opens the cart, follows the protected checkout redirect, signs in using public demo credentials, validates a new delivery address, selects delivery and demo payment, applies SOLAR10, reviews the expected ৳16,730 total and places one local order. It then follows the confirmation history link. The recipient has 73 characters to exercise wrapping.

Each project scans 15 representative states using `@axe-core/playwright` with WCAG 2 A/AA and WCAG 2.1 A/AA tags: product, populated cart, login, checkout address, checkout review, confirmation, order history, home, catalogue, account dashboard, address form, order details, tracking, contact and FAQ. Every serious or critical violation fails the suite. Each run attaches full rule results to its Playwright report; a later run may replace that ignored report. The checked-in compact summaries retain all violation severities and rule IDs requiring manual review. Incomplete axe rules are not claimed to pass.

Responsive checks cover 360, 768 and 1440 CSS-pixel viewports. Login is checked before authentication; the signed-in route matrix covers home, catalogue, product details, populated cart, dashboard, address form, populated checkout, confirmation, history, order details, contact and FAQ. After the normal purchase, only the isolated test's saved order snapshot is changed to a consistent `Number.MAX_SAFE_INTEGER` unit price, line total, subtotal and total, with zero delivery/discount/tax. The normal repository reader renders this layout fixture. It does not change production fixtures or purchasing rules. The displayed extreme amount is asserted before measuring overflow.

Overflow compares `document.documentElement.scrollWidth` with `clientWidth` in the same CSS units, allowing one pixel for rounding. At a 1440-pixel viewport, CSS `zoom: 2` checks reflow on catalogue, long order details and contact. This is a 200% CSS zoom test; browser-toolbar zoom, operating-system magnification and mobile pinch zoom were not tested.

Native FAQ summaries are reached with Tab and opened with Enter, then closed with Space in the actual browser. The mobile navigation dialog is reached and opened by keyboard; focus starts on its close button, stays inside through boundary Tab/Shift+Tab, and Escape closes it and returns focus to the opening button. Route changes and checkout review move focus to the new content. Stylesheet contrast and target-size findings are documented in [contrast.md](contrast.md).

## Findings and verification

The first run completed the keyboard journeys and responsive cases in both projects, and found two serious axe defects: review-star containers used an unsupported accessible label on an unnamed `div`, and image links omitted their visible Special offer label from the accessible name. Both were corrected before the final verification run. These initial failures are not counted as passing evidence.

The full desktop/mobile audit rerun passed all **4 cases in 1.6 minutes**. It executed **30 axe scans** with axe-core 4.14.0 and found **zero violations of any severity**, including zero serious or critical violations. Both projects completed the purchase with keyboard input. The two responsive cases passed **84 overflow measurements** combined, including the long recipient, extreme safe-integer order totals and six 200% CSS-zoom route checks. Native Enter/Space disclosure behavior and dialog focus checks passed in both projects.

The product review's paragraph rating label was then given an explicit image role, resolving an indeterminate ARIA naming finding. A focused browser regression passed **2/2 cases in 6.4 seconds**, confirmed the named image role and executed two more axe scans with zero violations; the ARIA incomplete finding was absent. TypeScript checks passed after these changes.

Evidence:

- [Desktop 15-state summary](axe-chromium.json) and [mobile 15-state summary](axe-mobile-chromium.json).
- [Desktop rating follow-up](axe-product-followup-chromium.json) and [mobile rating follow-up](axe-product-followup-mobile-chromium.json).
- Both main summaries report no minor or moderate violations as well as no serious/critical violations.
- Axe still requires manual review for `color-contrast` on product/home artwork and `label-content-name-mismatch` in several states. These are recorded as incomplete, not passed. The original product `aria-prohibited-attr` incomplete is superseded by the focused follow-up; it is preserved in the original summary rather than rewritten as historical success.

Reproduce the focused follow-up with:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- tests/e2e/accessibility.spec.ts --grep 'product review ratings'
```

Screenshots generated by the desktop project are [home at 360px](screenshots/home-360.png), [filled checkout at 360px](screenshots/checkout-360.png), and [product at 1440px](screenshots/product-1440.png). These are review artifacts, not timing or device-fidelity claims.

## Limits

No physical-device, screen-reader, browser-toolbar zoom or operating-system high-contrast session was performed. Automated checks and keyboard observations do not establish universal WCAG conformance. Axe incomplete rules, dynamic announcement quality and real assistive-technology behavior still require manual review before production release. Firefox/WebKit journey evidence is tracked in TASK-038 rather than inferred from Chromium.

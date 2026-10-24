# Contrast and control presentation audit

TASK-036 source review uses the WCAG relative-luminance formula for sRGB: each channel is linearized at 0.04045, weighted by 0.2126/0.7152/0.0722, and compared as `(lighter + 0.05) / (darker + 0.05)`. Tests include the black/white reference ratio of 21:1 and identical-color ratio of 1:1. Ratios below are rounded for display; assertions use the unrounded value.

The automated suite reads the actual stylesheet declarations and resolves its color tokens. Normal text is checked against 4.5:1 even where a heading could qualify for the lower large-text threshold. Essential input boundaries and focus indicators are checked against 3:1. Disabled controls, decorative separators and artwork are not represented as conforming text or control boundaries.

| Use                                        | Foreground        | Background        |   Ratio | Result         |
| ------------------------------------------ | ----------------- | ----------------- | ------: | -------------- |
| Body/headings                              | `#0B2545`         | white             | 15.39:1 | Pass           |
| Primary action text                        | white             | `#18864B`         |  4.62:1 | Pass           |
| Primary hover text                         | white             | `#126B3B`         |  6.58:1 | Pass           |
| Destructive action/error text              | white / `#A52525` | `#A52525` / white |  7.26:1 | Pass           |
| Muted body text                            | `#536270`         | white             |  6.27:1 | Pass           |
| Muted text and placeholder on pale surface | `#536270`         | `#F5F7F6`         |  5.83:1 | Pass           |
| Text action/stock text                     | `#126B3B`         | white             |  6.58:1 | Pass           |
| Hero eyebrow                               | `#366342`         | `#EDF3E8`         |  6.15:1 | Pass           |
| Hero supporting copy                       | `#4B6155`         | `#EDF3E8`         |  5.92:1 | Pass           |
| Rating text/icon                           | `#86600A`         | white             |  5.69:1 | Pass           |
| Review stars                               | `#947015`         | white             |  4.58:1 | Pass           |
| Offer label                                | `#805510`         | `#FFF7E2`         |  6.10:1 | Pass           |
| Footer body/link text                      | `#DCE4EC`         | `#0B2545`         | 11.98:1 | Pass           |
| Footer demo note                           | `#B9C9D8`         | `#0B2545`         |  9.09:1 | Pass           |
| Demo notice text                           | `#5C4A25`         | `#FFF6DE`         |  7.92:1 | Pass           |
| Yellow accent with navy text               | `#0B2545`         | `#F4B942`         |  8.69:1 | Pass           |
| Input boundary                             | `#71838F`         | white             |  3.93:1 | Pass, non-text |
| Input boundary on pale search surface      | `#71838F`         | `#F5F7F6`         |  3.65:1 | Pass, non-text |

White on the yellow accent is only 1.77:1 and is not an approved text pair. Green text on the pale hero is only 4.08:1, so hero small text uses the darker explicit colors above. Dark action text is retained on pale badges; white text is confined to dark or qualifying primary fills.

The original input boundary `#8B9BA6` was 2.86:1 against white. `--control-border: #71838F` replaces it for inputs, including the search field. Pale `--border` remains appropriate for decorative card/panel separators. Undefined `--line` references in checkout, history and FAQ panels were replaced with `--border`. Placeholder color is explicit muted text at full opacity rather than a translucent browser/theme default.

## Focus and target sizes

The previous single green outline was only 2.75:1 against the dark promotion surface. Focus now combines a 3px navy outline, 3px offset and 3px white inner halo. Navy and white contrast with one another at 15.39:1; at least one color exceeds 3:1 against each tested white, pale, navy, dark-promotion, green, red and yellow surface. System `Highlight` replaces the ring in forced-colors mode. This confirms the selected colors, not a claim about every operating system's rendering.

Programmatic focus on the main landmark uses a short 3px green top indicator on white (4.62:1) instead of outlining the full long page. Interactive controls retain the full two-color ring. Skip navigation, route focus movement, keyboard flow and modal focus behavior need their actual browser evidence as recorded separately in the progress tracker.

Buttons, wishlist controls, product-detail links, checkbox labels, category/account/mobile navigation and footer contact/policy targets aim for at least 44 CSS pixels. Inline links within prose remain inline. Product prices and order totals wrap when long rather than forcing a wider viewport. The contact section spans the footer at narrow widths so sample email text has useful space. Reduced-motion overrides remain enabled.

Run `npm test -- --run tests/unit/contrast.test.ts` to verify the stylesheet pairs. Browser automated accessibility checks, viewport/zoom screenshots and keyboard observations supplement this source audit; they do not establish screen-reader certification or universal WCAG conformance.

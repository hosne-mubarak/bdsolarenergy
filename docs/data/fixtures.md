# JSON fixtures and asset provenance

Fixtures in `src/data` are read-only starting data, consumed only by JSON repository adapters. UI business content must come through hooks/repositories. Use stable IDs; variants are embedded in their owning product but have independent IDs and SKUs. Brands, categories, images and reviews use relationships rather than repeated live records.

The fixture set contains 48 sample products (six in each of eight leaf groups), ten categories including solar/electrical parents, four illustrative brands, eight local original SVG illustrations, reviews, a banner/navigation, site settings, shipping and payment configuration, coupons, policy pages, two public demo identities and default preferences. Addresses/orders initially start empty; successful demo interactions populate versioned browser state, never the imported files. Do not seed plaintext credentials into user fixtures.

All names, prices, warranty statements, reviews, contacts and policies are samples requiring owner review before production. Images are original vector drawings created specifically for this project, not product photographs; each image record carries dimensions, descriptive alt text and provenance. No external asset requests, third-party photo licenses or implied real-brand product claims are needed.

## Deterministic coverage

- Forty-eight products exceed three pages at pageSize 12; eight used leaf categories have two valid parents.
- Each group's first product has two SKUs. Each group includes in-stock, low-stock and out-of-stock examples plus discounted and full-price items.
- Four brands, specification entries, review averages, popularity and dates support filtering/sorting/collections.
- Dhaka and other configured districts have separate delivery fees/free-shipping thresholds.
- COD, mobile financial service and card choices are marked simulation-only and never require credentials.
- `SOLAR10`, `WELCOME500`, `FREESHIP` and category-limited `PANELS5` are active over a wide explicit interval; `EXPIRED` is intentionally expired. Tests inject a fixed clock rather than relying on the machine date.
- Feature/error tests inject missing/malformed datasets; runtime data does not fail randomly.

## Editing rules

Validate record schemas and run the fixture integrity suite after editing. IDs/slugs/SKUs must be unique; relationships must resolve; categories cannot cycle; navigation/CTA paths must match known route patterns. Keep money in integer poisha and timestamps UTC. Preserve the test edge cases or replace them deliberately with equivalent coverage.

Mutable cart/wishlist/profile/address/order state is layered over this baseline behind repository interfaces. The browser persistence adapter is responsible for versions, recovery and resets. A future DRF adapter maps backend data into these domain entities without changing page imports.

# Browser demo persistence

`createPersistence` is a synchronous infrastructure adapter with asynchronous feature repositories built on top. It receives a native-compatible store and injected runtime; tests use fresh `MemoryStorage`. Application keys are prefixed `bdsolarenergy:` and contain strict `{version, updatedAt, data}` JSON envelopes validated against aggregate schemas.

## Aggregate inventory

| Key after prefix    | Store        | Responsibility                                                                                             |
| ------------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| `checkout`          | local        | Revision, owner-keyed carts, immutable order snapshots and variant reservations committed together         |
| `wishlists`         | local        | Revision and owner-keyed product IDs                                                                       |
| `identities`        | local        | Sample/registered public profiles and optional salted password verifier; profile edits update this overlay |
| `addresses`         | local        | Owned address books with exactly one default per nonempty owner                                            |
| `preferences`       | local        | Owner-keyed fixture-defined account preferences                                                            |
| `quotes`            | local        | Latest owned, normalized ten-minute checkout review snapshot                                               |
| `checkout-attempts` | local        | Owned quote-to-idempotency-key mappings retained for retries                                               |
| `session`           | local or tab | Remembered seven-day metadata or non-remembered one-day metadata; no production access token               |
| `reset-intents`     | tab          | Expiring fifteen-minute, single-use local password-reset demonstration                                     |

Local means browser `localStorage`; tab means `sessionStorage`. All customers using the same browser share the underlying demo namespace, while repositories and query keys scope returned records to the active identity. These checks are bypassable by someone controlling the browser. Do not enter real passwords or sensitive data. Registered demo passphrases use PBKDF2 verifiers rather than plaintext, but this is not production authentication. The seeded public demo passphrase is intentionally bundled configuration.

## Recovery and reset

- Missing keys return validated cloned seed data without unnecessary writes. Addresses and orders initially start empty.
- Invalid JSON, malformed records and unsupported older data reset only that aggregate and announce recovery. Other demo aggregates remain intact.
- Known migrations run one version at a time, validate the final payload and persist the updated envelope.
- Future versions throw a conflict and preserve raw data until an explicitly confirmed reset. They are never silently downgraded.
- Quota/read/remove failures become `storage_unavailable`; failed writes never return successful mutations. A partially failed reset is reported as failed.
- Confirmed reset enumerates only this application's keys in both stores, preserves unrelated browser keys and clears affected queries/session. It removes every local customer's demo data in this browser. Cancellation preserves data.
- Reset is available from settings and the public footer, including when newer saved authentication data blocks account access. A synchronous session-transition fence lasts through committed home navigation.

Local writes notify subscribers. `ShoppingProvider` handles application-key storage events and invalidates cached projections rather than maintaining another copy of cart/order state. The native bridge helper also supports matching-storage-area filtering. Tab storage is separate from other independent tabs; events do not provide server synchronization. Dispose listeners when providers/bridges unmount.

## Transactions and future data migration

One `checkout` write appends an order, reserves current-browser stock and clears its owner's cart. An unsuccessful write preserves the old aggregate. Retained retry keys allow recovery of the same owned order after cart clearing or quote expiry. Profile and saved-address edits cannot alter order snapshots. See [order placement](../domain/order-placement.md) for validation and duplicate-submit behavior.

Revision checking detects observed contention, but localStorage has no cross-tab atomic compare-and-swap. These aggregates provide no distributed transaction, cross-device stock or merchant payment guarantee. Cart and wishlist merges are independently atomic/repeatable; a partial multi-aggregate sign-in failure is surfaced and can be retried.

Fixture JSON files are never mutated. A backend adapter must not upload credential verifiers, sessions or reset intents. Agree guest-intent import, privacy/retention, ownership, idempotency and schema-version rules before migrating any browser data. [DRF migration](../api/migration.md) separates this completed demonstration from future transport, security and live-commerce work.

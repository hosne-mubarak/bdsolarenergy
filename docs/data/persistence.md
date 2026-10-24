# Browser demo persistence

`createPersistence` is a synchronous infrastructure adapter with asynchronous feature repositories built on top. It receives a native-compatible store and injected runtime; tests use `MemoryStorage`, never a production credential file. Application keys are prefixed `bdsolarenergy:` and values are strict `{version,updatedAt,data}` JSON envelopes validated against aggregate schemas.

- Missing keys return validated cloned seed data without unnecessary writes.
- Invalid JSON, malformed records and unsupported older data reset only that aggregate, notify subscribers and record a user-visible recovery notice.
- Known migrations run one version at a time, validate the final payload and persist the updated envelope.
- Future versions throw a conflict and preserve raw data until an explicitly confirmed reset. They are never silently downgraded.
- Quota/read/remove failures become `storage_unavailable`; failed writes never return a successful mutation. A partially failed reset must be reported as failed.
- Reset enumerates only this namespace, preserving other browser applications' keys. UI confirmation belongs in account settings.
- Local writes notify subscribers. The browser bridge observes storage events for the matching storage area; repository hooks invalidate affected cached data rather than maintaining a second state store.

Use separate local/session adapters for remembered and non-remembered identity metadata. Clear listeners with the browser bridge's dispose function. JSON fixture files remain unchanged by browser mutations.

The checkout aggregate owns carts, order snapshots and reservation totals together so a later order-placement write can update them as one local value. Local revision checking can detect contention, but no local-storage adapter provides distributed server transactions or cross-device stock guarantees. Those remain backend responsibilities.

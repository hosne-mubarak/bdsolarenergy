# Entity and input validation

TASK-004 defines runtime Zod schemas in `src/schemas` and inferred TypeScript types in `src/types`. These are the domain boundary shared by JSON adapters and future API response mappers. Components consume entities through hooks, never unvalidated fixture objects.

## Validation layers

1. Primitive schemas reject unsafe/fractional/negative money, invalid quantities and malformed identity/time fields. Money is integer poisha; formatting is a separate concern.
2. Entity schemas describe the shape and local invariants of a record, including product variants, purchase snapshots and session metadata.
3. Form/input schemas validate user submissions, including password confirmation and Unicode-safe recipient/address text. A valid address is not automatically eligible for a delivery zone.
4. Fixture integrity checks in TASK-005 validate cross-record uniqueness/references, category cycles and sample coverage. A single-record schema cannot establish those relationships.
5. Repository mutations validate authoritative business constraints and ownership again; a valid form is not permission to mutate a foreign record or trust a UI order total.

Inferred types must come from the schemas rather than a separately maintained duplicate entity definition. Do not import concrete JSON or UI modules into schemas. Tests must cover positive fixtures and rejection cases, including unsafe money and normalized duplicate-email keys.

## Storage and API boundaries

Versioned persistence validates an envelope before returning mutable data. Migration and recovery behavior belongs to the persistence adapter, not to a page or Zod transform. Authentication verifiers remain demo-only; session metadata must not contain a plaintext password. Order item/address/price snapshots intentionally differ from live product/profile relationships.

DRF wire DTOs may eventually differ from these domain entities. A future API adapter must validate and map DTOs before resolving the same repository contracts; do not teach every page a backend response shape.

# Demo authentication

This browser-only identity system is demonstrative and bypassable. It does not provide production authentication, permissions, recovery, email verification or session security. The future backend must enforce all of those boundaries.

Public seed access is exposed through `AuthRepository.getDemoAccess`: `demo@example.com` / `SolarDemo123!`. This deliberately bundled passphrase is not a secret; never reuse it for a real account. Seed fixture users do not contain persisted passwords. Registration derives a random 16-byte salt and PBKDF2-SHA-256 verifier using 150,000 rounds; only salt/hash/algorithm/round count and public profile data are stored. Browser-controlled verifiers are not a substitute for server password handling.

Non-remembered session metadata is stored in sessionStorage; remembered metadata in localStorage. Both contain only user ID and expiry, under strict versioned envelopes. Expiry is one day or seven days respectively. Session restoration validates identity existence and expiry; account queries use owner-scoped keys and wait for restoration. The provider refreshes on focus and polls at 30 seconds. Every repository mutation still resolves the live session, regardless of a cached UI projection.

Storage failures are typed errors, not successful logins. Session-scope switching compensates a failed cleanup where possible; registration attempts rollback after a session write failure. If storage denies both the original operation and compensation, the UI reports failure and the local demo may require sign-in or a namespace reset. No cross-storage atomicity is claimed.

Recovery returns generic simulated feedback and never sends mail. Known local accounts receive a tab-scoped 15-minute one-use reset intent. The intent is consumed before updating credentials, so a subsequent storage failure requires a new request. Verification status is explicitly simulated; changing a password updates only the local verifier. These methods receive UI and dedicated lifecycle checks in TASK-024.

Logout clears both session scopes. Account-cache cleanup, guest merge orchestration, route protection and safe redirect behavior are integrated in TASK-025; these are UI/privacy behavior for a demo, not server authorization. Cart/wishlist repositories already resolve owner identity internally. No Django service or external API is required.

## Verified guard and merge integration (TASK-025)

Private routes wait for session restoration; guest-only routes resume only safe internal destinations and reject authentication redirect loops. Login/registration keep their forms mounted during completion while protected screens wait. Guest cart/wishlist merges are repeat-safe and each clears its source only after its atomic write succeeds. If a later merge fails, sign-in completion clears the session and reports that items are preserved; retrying safely reuses any already moved account items.

Explicit logout waits for home navigation before finishing its transition, preventing the login guard from replacing the intended destination. Private shopping projections are cancelled and removed during transitions, with owner checks guarding response/cache-key mismatches. These behaviors were tested with restoration delays, expired sessions, quantity reductions, partial merge failure and second-account isolation.

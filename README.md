# bdsolarenergy.com

Planning repository for a React storefront selling solar and electrical equipment in Bangladesh.

The application has **not been implemented**. The approved deliverable for this phase is the [development plan](docs/DEVELOPMENT_PLAN.md), including architecture, routes, data contracts, acceptance criteria, and a dependency-aware backlog.

Start future implementation with TASK-001 and follow the documented dependencies. Do not begin implementation automatically as part of this planning phase.

## Planned developer commands

Once TASK-002 establishes the project, its README update must document verified runtime versions and these scripts:

```sh
npm ci
npm run dev
npm run lint
npm run format:check
npm run typecheck
npm run test -- --run
npm run test:e2e
npm run build
npm run preview
```

These are proposed commands, not currently executable scripts. There are no dependencies to install, application to start, or application tests to run in this planning-only repository.

## Design boundaries

- JSON fixtures provide catalogue data; typed repositories isolate data access.
- Browser persistence simulates carts, wishlists, accounts, addresses, and orders.
- Authentication, email workflows, order tracking, and payments are demonstrations, not production services.
- Future Django REST Framework adapters must preserve feature-facing repository contracts.
- No backend or application code is included in this phase.

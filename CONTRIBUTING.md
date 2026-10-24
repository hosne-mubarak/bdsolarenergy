# Contributing

Read the [development plan](docs/DEVELOPMENT_PLAN.md), [architecture decisions](docs/architecture/decisions.md) and [implementation progress](docs/implementation-progress.md) before changing code.

## Task workflow

1. Inspect Git status, current branch and relevant files. Preserve existing work. Use `feature/bdsolarenergy-react-ecommerce` for the current implementation; do not reset it or overwrite another contributor's changes.
2. Select the first unfinished task with completed prerequisites. Mark it In Progress and list its expected files in the progress document.
3. Implement only that task's scope. Follow the approved architecture, reuse existing conventions and document a justified dependency/architecture change before making it.
4. Add meaningful tests appropriate to the task. Run relevant checks and fix regressions before declaring it complete.
5. Update its progress entry with files changed, exact validation outcomes, outstanding issues and next eligible task. Summarize completion before moving on.
6. Do not commit, push or deploy without an explicit instruction authorizing that action. A prior planning-phase push does not authorize implementation commits.

## Code and data boundaries

Use strict TypeScript and the naming conventions in the decision record. UI must not import JSON, fetch directly, access browser storage or calculate checkout business rules. Feature hooks call asynchronous repository contracts. Services own adapters; domain modules contain pure rules. Keep business content in fixtures, mutations in versioned persistence and private data scoped to its user.

Use integer poisha and UTC storage timestamps. Product IDs/SKUs must remain stable. Do not duplicate totals across state stores or add speculative abstraction layers. Future API adapters map transport details to the same entities and errors; pages must remain data-source-independent.

## Quality checks

Run the established tooling commands from the repository root:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:e2e
```

Run tests relevant to the changed behavior and required task acceptance checks. Report the actual runner result, including counts and any skipped/unrun cases. Never claim application readiness from lint or a zero-test run. Documentation changes require link/reference, consistency and whitespace checks; they do not require fabricated application tests.

## Review checklist

- State task ID, user-visible result and prerequisite completion.
- List changed files and explain consequential choices.
- Include validation commands/outcomes and any limitations.
- Verify loading/error/empty states and accessibility where UI is involved.
- Preserve fixture/repository/domain boundaries and future DRF contracts.
- Label demo auth, recovery, tracking, payments and sample content honestly.
- Never add credentials, plaintext persisted passwords or real payment input.
- Update documentation/progress and leave unrelated files untouched.

Production policy, contact, catalogue, provider and hosting decisions remain owner inputs; use marked defaults from the architecture record for demo development. Deployment and a backend are outside this phase.

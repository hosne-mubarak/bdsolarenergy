# Tested toolchain

TASK-002 resolves exact stable package versions into `package.json` and `package-lock.json`. The runtime is Node 24.19.0 and npm 11.9.0. Use `npm ci` to reproduce the dependency graph rather than resolving new versions.

## Compatibility decisions

- Vite 8 and Vitest 5 support the pinned Node 24 runtime. React and React DOM use the same version. TypeScript 6 is within the selected typescript-eslint supported range.
- ESLint 10 is supported by both TypeScript ESLint and the React hook plugin. The initial ESLint 9 candidate was deprecated, so it was replaced before validation.
- Resolver 6.0.0 produced an optional peer conflict between Effect 4 and the TypeSchema Effect 3 adapter during npm resolution. Use compatible `@hookform/resolvers` 5.9.2 with React Hook Form/Zod; no `--force` or `--legacy-peer-deps` was used.
- Node typings follow Node 24 rather than the registry's newer Node 26 typings.
- No additional runtime state store or UI kit is installed. Testing-library DOM/matchers/user-event, jsdom and browser tooling support the planned tests.
- TLS and package integrity verification remain enabled. `.npmrc` changes only cache location, exact saving and engine enforcement.

## Exact direct dependencies

| Package                       | Version   | Use                 |
| ----------------------------- | --------- | ------------------- |
| `@hookform/resolvers`         | `5.9.2`   | Runtime             |
| `@tanstack/react-query`       | `5.104.5` | Runtime             |
| `lucide-react`                | `1.61.0`  | Runtime             |
| `react`                       | `19.3.1`  | Runtime             |
| `react-dom`                   | `19.3.1`  | Runtime             |
| `react-hook-form`             | `7.90.0`  | Runtime             |
| `react-router`                | `8.5.0`   | Runtime             |
| `zod`                         | `3.25.76` | Runtime             |
| `@eslint/js`                  | `10.0.1`  | Development/testing |
| `@playwright/test`            | `1.64.1`  | Development/testing |
| `@tailwindcss/vite`           | `4.3.3`   | Development/testing |
| `@testing-library/dom`        | `10.4.2`  | Development/testing |
| `@testing-library/jest-dom`   | `7.0.1`   | Development/testing |
| `@testing-library/react`      | `16.3.3`  | Development/testing |
| `@testing-library/user-event` | `14.6.8`  | Development/testing |
| `@types/node`                 | `24.19.2` | Development/testing |
| `@types/react`                | `19.3.0`  | Development/testing |
| `@types/react-dom`            | `19.3.0`  | Development/testing |
| `@vitejs/plugin-react`        | `6.1.2`   | Development/testing |
| `eslint`                      | `10.13.0` | Development/testing |
| `eslint-plugin-react-hooks`   | `7.1.1`   | Development/testing |
| `eslint-plugin-react-refresh` | `0.5.7`   | Development/testing |
| `globals`                     | `17.13.0` | Development/testing |
| `jsdom`                       | `30.1.3`  | Development/testing |
| `prettier`                    | `3.9.10`  | Development/testing |
| `tailwindcss`                 | `4.3.3`   | Development/testing |
| `typescript`                  | `6.0.3`   | Development/testing |
| `typescript-eslint`           | `8.72.0`  | Development/testing |
| `vite`                        | `8.3.5`   | Development/testing |
| `vitest`                      | `5.0.5`   | Development/testing |

## Validation scope

The initial smoke tests validate React rendering, Tailwind compilation, the demo disclosure, mobile overflow and reload behavior. They do not validate catalogue, authentication or purchase flows, which have not been implemented. Current command results are recorded in [implementation progress](../implementation-progress.md). CI configuration is supplied but remote GitHub Actions has not run because implementation changes remain uncommitted/unpushed.

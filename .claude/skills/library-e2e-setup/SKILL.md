---
name: library-e2e-setup
version: 1.0.0
description: Create E2E test projects for publishable hyperfrontend libraries. Use when adding E2E tests for a new library, fixing lib-e2e-project-required lint errors, or verifying package outputs work in ESM, CJS, IIFE, and UMD.
allowed-tools:
  - Read
  - Write
  - Edit
  - Terminal
---

# Library E2E Setup

`make-publishable` generator creates E2E project. Manual setup rarely needed.

---

## Paths

| Item         | Path                       |
| ------------ | -------------------------- |
| E2E projects | `apps/package-e2e/<name>/` |
| Packed tgz   | `tmp/e2e-packs/`           |
| ESLint rule  | `lib-e2e-project-required` |

---

## Naming

`lib-my-utils` → `e2e-lib-my-utils` at `apps/package-e2e/my-utils/`

---

## Key Files

Generator creates: `project.json`, `package.json`, `tsconfig.json`, `jest.config.{esm,cjs,browser}.ts`, `src/<name>.spec.ts`

**Critical fields:**

```json
// project.json
{ "implicitDependencies": ["lib-<name>"], "tags": ["type:e2e", "scope:internal"] }

// package.json dependencies
{ "@hyperfrontend/<name>": "file:../../../tmp/e2e-packs/hyperfrontend-<name>-x.x.x.tgz" }
```

---

## Run

```bash
nx e2e e2e-lib-<name>
```

```

```

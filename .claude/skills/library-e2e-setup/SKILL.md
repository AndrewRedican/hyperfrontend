---
name: library-e2e-setup
description: Create E2E test projects for publishable hyperfrontend libraries. Use when adding E2E tests for a new library, fixing lib-e2e-project-required lint errors, or verifying package outputs work in ESM, CJS, IIFE, and UMD.
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

Generator creates: `project.json`, `package.json`, `tsconfig.json`, `src/{esm,cjs,iife,umd}.spec.ts`

## Spec shape

`esm.spec.ts` and `cjs.spec.ts` run on `usePackedConsumer` from `@hyperfrontend/testing/consumer`: the executor passes the packed tarball as `HF_E2E_TARBALL`, the helper installs it into a temp dir outside the workspace, and every test runs under plain Node with no loader hooks. `consumer.entries('import' | 'require')` loads every exports subpath; `consumer.run(fn, { kind, args })` serialises `fn` into the consumer and returns its JSON result, so the body imports the package itself and closes over nothing. Browser bundles stay on `iife.spec.ts` / `umd.spec.ts` with the shared helpers.

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

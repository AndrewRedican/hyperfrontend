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
| Lint rule    | `lib-e2e-project-required` |

---

## Naming

`lib-my-utils` → `e2e-lib-my-utils` at `apps/package-e2e/my-utils/`

---

## Key Files

Generator creates: `project.json`, `package.json`, `tsconfig.json`, `src/{esm,cjs,iife,umd}.spec.ts`

## Spec shape

Every spec runs on `usePackedConsumer` from `@hyperfrontend/testing/consumer`: the executor passes the packed tarball as `HF_E2E_TARBALL`, the helper installs it into a temp dir outside the workspace, and every test runs under plain Node with no loader hooks. `consumer.entries('import' | 'require')` loads every exports subpath; `consumer.run(fn, { kind, args })` serialises `fn` into the consumer and returns its JSON result, so the body imports the package itself and closes over nothing. The generated `iife.spec.ts` / `umd.spec.ts` read `bundle/index.<format>.js` from the package installed in the consumer and run it as a classic script (and, for UMD, as a CommonJS module) with helpers of their own; they import nothing outside the e2e project. Older e2e projects still use `apps/package-e2e/shared/helpers.ts`, which reads `dist/`.

**Critical fields:**

```json
// project.json
{ "implicitDependencies": ["lib-<name>"], "tags": ["type:e2e", "scope:internal"] }

// package.json dependencies
{ "@hyperfrontend/<name>": "file:../../../tmp/e2e-packs/hyperfrontend-<name>-x.x.x.tgz" }
```

The e2e executor rewrites that dependency on install (`npm install <tarball> --save-exact`) and the version flow repins it on every bump; a new e2e project gets no `scripts` and no `devDependencies`.

---

## Run

```bash
npx hf run-many -t e2e -p e2e-lib-<name>
```

```

```

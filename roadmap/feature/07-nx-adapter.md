# 07 — Nx Adapter (Optional, opt-in plugin)

A **separate, optional** package that wraps the published SDK for teams that happen to use Nx.

**Depends on** [03 — Core SDK](03-core-sdk.md) and [05 — CLI](05-cli.md) (it delegates to both). See the [index](README.md) for shared invariants.

> **This is deferrable and never a blocker for the core SDK.**

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — the adapter is a new publishable package and obeys all the same lint-enforced conventions (no enums, no direct built-in calls, import/export ordering, required JSDoc, categorized comment prefixes, file-size limits, one-assertion tests) plus the New Library checklist in the `coding` skill (shared invariant 9). Fix violations preemptively.

> Project-name note: per repo convention the Nx project for `@hyperfrontend/features-nx` is `lib-features-nx` (the verification commands below use that name).

---

## Why this is opt-in only

This is an **opt-in plugin** in the new sense (see [01 — Reposition & Publishability](01-reposition-and-publishability.md), Phase 2.0) — a convenience for teams that happen to use Nx, never a requirement. The core SDK and CLI work in any workspace without Nx, and **`@hyperfrontend/features` must not depend on this package.** The publishability boundary checks in [01](01-reposition-and-publishability.md) explicitly verify there is no consumer-facing dep on `@hyperfrontend/features-nx`.

It lives as a **separate, new package** (e.g. `@hyperfrontend/features-nx`, scaffolded with `@hyperfrontend/package:library`) that wraps the published SDK. Port the design from the old `init`/`add` generators and `serve` executor (salvaged in [01](01-reposition-and-publishability.md), Phase 2.0) into thin Nx generators/executors that delegate to the SDK ([03](03-core-sdk.md)) and CLI ([05](05-cli.md)) — `build`/`dev` executors call the SDK build + dev server; `generators.json` / `executors.json` register the wrappers.

---

## Phase 6 — Build the adapter

Scaffold with `@hyperfrontend/package:library` and wire thin generators/executors that delegate to the SDK + CLI. Keep all real logic in the core package; the adapter is a wrapper.

**Verification:**

```bash
npx nx test lib-features-nx
npx nx lint lib-features-nx --fix
npx nx typecheck lib-features-nx
```

### Final review (before marking this plan complete)

After the adapter code changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-features-nx --skip-nx-cache
npx nx lint lib-features-nx --skip-nx-cache
npx nx test lib-features-nx --skip-nx-cache
npx nx build lib-features-nx --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- Decide the exact generator/executor surface to port (`init`, `add`, `serve`, `build`, `dev`) and which map to generators vs. executors.
- Confirm the package name (`@hyperfrontend/features-nx` is illustrative).

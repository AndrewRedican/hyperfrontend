# 02 — CLI/bin Execution Across Package Managers

**Parallel prerequisite.** This can proceed in parallel with [01 — Reposition & Publishability](01-reposition-and-publishability.md) and the [03 — Core SDK](03-core-sdk.md), and it does **not** block the Phase 2.0 repositioning — but it **does** gate shipping a working `npx @hyperfrontend/features` CLI ([05](05-cli.md)).

See the [index](README.md) for shared invariants. The relevant one here: shipping `npx @hyperfrontend/features` requires the builder-produced bin to resolve under every target package manager.

---

## Before writing any code

This is primarily a research/verification task, but if it surfaces a gap that must be fixed in `@hyperfrontend/builder` (the gating rule below), read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **before** touching builder source — those conventions are lint-enforced and fail CI (shared invariant 9). Fix violations preemptively.

---

## What is already covered

`@hyperfrontend/builder` already produces JS bin CLIs end-to-end: `buildJsBin` (`@hyperfrontend/builder/bin/script`) bundles per declared format, prepends the `#!/usr/bin/env node` shebang, appends the runner bootstrap footer, names outputs `.mjs`/`.js`/`.cjs.js`, and `chmod`s them to `0o755`; the package-json synthesizer emits the `bin` field with correct relative paths and adds the bin to the `files` allowlist. So shebang, file permissions, and bin metadata are covered **in principle**.

---

## Research goal

Confirm the produced package actually runs as a CLI under every target package manager:

- `npx @hyperfrontend/builder` / `npx @hyperfrontend/features`
- `pnpm dlx @hyperfrontend/builder` / `pnpm dlx @hyperfrontend/features`
- `yarn dlx ...` and Nx's own task/bin resolution

Verify, against a real packed tarball (`npm pack`) of `@hyperfrontend/builder`, that for npm, pnpm, Yarn, and Nx: the `bin` map, `files`/exports allowlist, shebang line, executable bit, and on-disk layout are all sufficient for `dlx`/`npx` resolution.

---

## Outcome / gating rule

If any package manager exposes a gap (e.g. missing executable bit after extraction, wrong `bin` key, ESM-shebang interop), **fold the fix into `@hyperfrontend/builder`** _before_ `@hyperfrontend/features` depends on it for its CLI.

This is why the CLI/bin line item on the [publishability checklist](01-reposition-and-publishability.md#phase-21--promote-to-a-publishable-package) is gated on this research, and why [05 — CLI](05-cli.md)'s published bin cannot ship until this resolves clean.

### Final review (before marking this plan complete)

If a fix is folded into `@hyperfrontend/builder`, run the full gate against the builder with the Nx cache disabled as a final review-and-polish pass and do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck lib-builder --skip-nx-cache
npx nx lint lib-builder --skip-nx-cache
npx nx test lib-builder --skip-nx-cache
npx nx build lib-builder --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- Decide whether Yarn (classic vs. berry) `dlx` resolution differences matter for the target audience, or whether only Yarn berry needs to pass.
- Capture the verification steps as a repeatable check (ideally folded into the builder's own E2E) so future builder changes don't regress bin execution.

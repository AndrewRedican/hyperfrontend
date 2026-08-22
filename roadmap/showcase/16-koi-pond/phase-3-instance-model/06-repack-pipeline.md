# Repack pipeline

Part of [Phase 3](README.md) · Guardrails: [plan index](../README.md)

## Goal

Bring the whole family live on contract 0.8.0 in one coherent repack. Both contract sides
must agree on major and minor, so this is the step where everything from phases 1 and 3
becomes real in the composed site.

## The order (each step assumes the previous)

1. `npx nx run demo-koi-lib:build && npx nx run demo-koi-lib:refresh && npx nx run demo-koi-lib:verify`
   (the committed `file:` tarball now carries the 0.8.0 lib).
2. Fish `feature.config.ts` at 0.8.0 across all eight (part of
   [05-fish-migration.md](05-fish-migration.md); confirm here).
3. Rebuild and repack the eight fish shells (`refresh-fish-shells`).
4. **Hand-prune every 0.7.0 shell tarball** from both locations:
   `apps/demos/koi-pond/host/vendor/` and `dist/apps/demos/koi-pond/fish-shell/`. Stale
   same-name tarballs are the classic source of "verified but old" composed builds.
5. Re-run `apps/demos/koi-pond/host/scripts/install-vendored-shells.mjs`.
6. Commit tarballs, `package.json`, and the lockfile **together** (a tarball swap without
   its lock entry breaks clean installs).

## Cautions

- Never overlap two Nx builds of the same project into one dist dir; overlapping builds
  race and corrupt output. Run the repack serially.
- Every vendored shell package name stays in `dependency-checks`
  `ignoredDependencies` by exact name (guardrail 8); verify after the swap, because
  `lint --fix` deletes what it does not recognize.
- Commit shape: per-project commits for the fish config bumps; one `demo-koi-pond` commit
  for the vendor swap (the host owns `vendor/`).

## Specs

- `demo-koi-lib:verify` green; no new specs (pipeline step).

## Documentation impact

- None; the koi skill's pipeline description is refreshed in
  [phase 5](../phase-5-integration/03-doctrine-rewrites.md).

## Verification

```bash
npx nx run-many -t test build lint typecheck -p demo-koi-lib demo-koi-pond demo-koi-fish-vanilla demo-koi-fish-react demo-koi-fish-vue demo-koi-fish-svelte demo-koi-fish-solid demo-koi-fish-preact demo-koi-fish-lit demo-koi-fish-angular
npx http-server dist/apps/demos/koi-pond/site -p 4288
```

Then the full [phase gate browser checklist](README.md#phase-gate).

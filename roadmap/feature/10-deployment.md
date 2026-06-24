# 10 — Deployment

Where the pieces run and the CI/CD workflows that ship them: docs on Vercel, demo features on Railway.

**Depends on** [08 — Demos](08-demos.md) and [09 — Docs-Site Integration](09-docs-site-integration.md). See the [index](README.md) for shared invariants.

---

## Before writing any code

This plan's deliverables are CI/CD workflow files rather than library source, but the same awareness rule applies: read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — in particular `lib-ci-workflows` (and use the `library-ci-workflows` skill) so the new workflows and path filters are lint-clean (shared invariant 9). Don't author deployment docs for features/pages that don't exist yet (shared invariant 10) — this plan only runs once [08](08-demos.md) and [09](09-docs-site-integration.md) land.

---

## Deployment decisions

| #   | Topic              | Decision                |
| --- | ------------------ | ----------------------- |
| 42  | Feature deployment | Railway (separate apps) |
| 43  | Docs deployment    | Vercel                  |

---

## Deployment architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  VERCEL                                                              │
├─────────────────────────────────────────────────────────────────────┤
│  hyperfrontend.dev                                                   │
│  ├── /                    Landing (carousel embeds Railway features)│
│  ├── /docs/*              Documentation pages                        │
│  ├── /demo/clock          Shell page → embeds clock from Railway    │
│  ├── /demo/heartbeat      Shell page → embeds heartbeat from Railway│
│  └── /demo/views          Shell page → embeds views from Railway    │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           │ iframe src (feature URLs)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RAILWAY                                                             │
├─────────────────────────────────────────────────────────────────────┤
│  clock-demo.up.railway.app      ← Clock feature (Vue)                │
│  heartbeat-demo.up.railway.app  ← Heartbeat feature (React)          │
│  views-demo.up.railway.app      ← Views feature (Vanilla JS)         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## CI/CD Configuration

**Files to create:**

- `.github/workflows/ci-lib-features.yml`
- `.github/workflows/deploy-demo-clock.yml`
- `.github/workflows/deploy-demo-heartbeat.yml`
- `.github/workflows/deploy-demo-views.yml`

> The library CI workflow (`ci-lib-features.yml`) and its path filters should be configured with the `library-ci-workflows` skill. Note that promoting the package in [01 — Reposition & Publishability](01-reposition-and-publishability.md) already adds a CI status workflow and leaves manual entries in `ci-libraries.yml` / `ci-main.yml`.

## Final review (before marking this plan complete)

The new workflows are YAML (no `nx typecheck`/`test` of their own), so the final review is two-fold: lint the workflow changes (`nx lint lib-ci-workflows --skip-nx-cache` if the workflow-lint project applies, plus the `library-ci-workflows` skill checks), and confirm the gate each workflow runs still passes with the cache disabled — since `ci-lib-features.yml` builds the library, re-run the lib-features gate as the polish pass before marking this plan complete:

```bash
npx nx typecheck lib-features --skip-nx-cache
npx nx lint lib-features --skip-nx-cache
npx nx test lib-features --skip-nx-cache
npx nx build lib-features --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- The Railway feature URLs are referenced as `process.env.*_FEATURE_URL` by the host SDK ([03 — Core SDK](03-core-sdk.md)); wire those env vars into both the Vercel build and local dev.

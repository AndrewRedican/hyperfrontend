# 09 — Docs-Site Integration

Embed the demo shells into the docs site: per-feature demo pages plus a landing-page carousel with live previews.

**Depends on** [08 — Demos](08-demos.md) (the shells must be built). The demo host is `apps/docs-site/` (decision 38); routes are Next.js pages that embed features via the shell (decision 39); the landing page is a carousel with live embedded previews (decision 40). Shells are consumed as local `workspace:*` deps (decision 41).

See the [index](README.md) for shared invariants. Deployment of these pages (Vercel) and the features they embed (Railway) is covered in [10 — Deployment](10-deployment.md).

---

## Before writing any code

Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — the docs-site React/TSX source obeys the same lint-enforced conventions plus the docs-site-specific rules (`docs-site-routes`, `docs-site-libraries`, etc.) in those docs (shared invariant 9). Fix violations preemptively.

> **Don't author the demo pages before the shells exist (shared invariant 10).** The demo pages and carousel embed the shell packages built in [08 — Demos](08-demos.md); they can't be written or wired up until those shells exist as `workspace:*` deps. Defer this whole plan until 08 lands.

---

## Phase 10.1 — Add Demo Shell Dependencies

**Files to edit:**

- `apps/docs-site/package.json` — Add workspace deps for demo shells

```json
{
  "dependencies": {
    "@hyperfrontend/demo-clock-shell": "workspace:*",
    "@hyperfrontend/demo-heartbeat-shell": "workspace:*",
    "@hyperfrontend/demo-views-shell": "workspace:*"
  }
}
```

---

## Phase 10.2 — Create Demo Pages

**Files to create:**

- `apps/docs-site/src/app/demo/clock/page.tsx`
- `apps/docs-site/src/app/demo/heartbeat/page.tsx`
- `apps/docs-site/src/app/demo/views/page.tsx`

---

## Phase 10.3 — Update Landing Page

**Files to edit:**

- `apps/docs-site/src/app/page.tsx` — Add demo carousel with live embeds

**Verification:**

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

### Final review (before marking this plan complete)

After the docs-site changes land, run the full gate with the Nx cache disabled as a final review-and-polish pass. Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck docs-site --skip-nx-cache
npx nx lint docs-site --skip-nx-cache
npx nx test docs-site --skip-nx-cache
npx nx build docs-site --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- This integration overlaps the broader docs reclassification in [11 — Documentation Cleanup](11-docs-cleanup.md) (which moves `@hyperfrontend/features` out of the "Plugins" sections). Coordinate so the demo pages land under the package — not plugin — navigation.

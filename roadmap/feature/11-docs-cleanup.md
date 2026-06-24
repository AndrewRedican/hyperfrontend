# 11 — Documentation Cleanup (deferred follow-up)

Reclassify `@hyperfrontend/features` from "Nx plugin" to "vendor-agnostic package" across all user-facing docs.

**Deferred.** Do this as a follow-up pass **once the package has moved to `libs/features/`** (see [01 — Reposition & Publishability](01-reposition-and-publishability.md)) — it is captured here so it is not lost, **not done now** (shared invariant 10: don't document a system before it has moved/exists). See the [index](README.md) for shared invariants; this plan executes the "plugin → package" reclassification implied by invariants 1–4.

---

## Before writing any code

Most touch-points are markdown, but several are docs-site TSX/TS source. Read the `coding` skill and skim the custom ESLint rule docs in [`tools/eslint-rules/docs/`](../../tools/eslint-rules/docs/) **first** — the docs-site-specific rules (`docs-site-libraries`, `docs-site-library-docs`, `docs-site-routes`, `root-readme-packages`) govern several files in the touch-point table and are lint-enforced (shared invariant 9). Fix violations preemptively.

---

## What changes (two intertwined edits everywhere)

1. **Reclassify the package:** `@hyperfrontend/features` is a **package**, not an Nx plugin. Move it out of every "Plugins" menu/section and out of `/docs/plugins/*` routes into the normal package listing. Replace `npx nx add @hyperfrontend/features` / `npx nx g @hyperfrontend/features:*` install-and-usage copy with the vendor-agnostic install + `npx @hyperfrontend/features <command>` CLI flow.
2. **Redefine "plugins":** wherever docs describe "plugins" generically, they should now mean **opt-in extensions consumers add** (experience plugins, display-mode plugins, the optional [Nx adapter](07-nx-adapter.md)) — not "Nx plugins shipped by the framework."

---

## Known touch-points

Verify before editing; line numbers drift.

| File                                                               | What to change                                                                                                                                                                   |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                        | "Nx plugin helps you…" intro, the `npx nx add` / `npx nx g` quick-start, and the packages-table row (currently links to `plugins/features` + `/docs/plugins/features/`)          |
| `apps/docs-site/src/lib/content.ts`                                | Entry `name: 'Features Plugin'`, `category: 'plugin'`, `readmePath: 'plugins/features/README.md'`, `entryPoints` → reclassify to a package category + new `libs/features/` paths |
| `apps/docs-site/src/app/docs/libraries/libraries-page-content.tsx` | The `category: 'plugin'`, "Nx Plugin" section heading, `/docs/plugins/features` href, and "Nx plugin with generators and executors" description                                  |
| `apps/docs-site/src/app/docs/quick-start/page.tsx`                 | "Add the plugin" step and `npx nx add` / `npx nx g @hyperfrontend/features:*` snippets                                                                                           |
| `apps/docs-site/src/components/value-proposition.tsx`              | Copy-to-clipboard `npx nx add @hyperfrontend/features`                                                                                                                           |
| `apps/docs-site/src/components/breadcrumb.tsx`                     | `plugins: 'Plugins'` / `features:` breadcrumb labels                                                                                                                             |
| `apps/docs-site/src/lib/navigation.ts`                             | "Plugin navigation items" — drop `features` from plugin nav, add to package nav                                                                                                  |
| `apps/docs-site/src/lib/docs-loader.ts`                            | `plugins/<slug>/README.md` + `/docs/plugins/${slug}` resolution for `features`                                                                                                   |

## Final review (before marking this plan complete)

After the reclassification edits land, run the full gate against the docs-site with the Nx cache disabled as a final review-and-polish pass (this catches broken routes, library-doc registrations, and link integrity). Do **not** mark this plan complete until all four pass clean:

```bash
npx nx typecheck docs-site --skip-nx-cache
npx nx lint docs-site --skip-nx-cache
npx nx test docs-site --skip-nx-cache
npx nx build docs-site --skip-nx-cache --exclude-task-dependencies
```

## Open questions / follow-ups

- Coordinate with [09 — Docs-Site Integration](09-docs-site-integration.md) so demo pages and the reclassified package navigation land consistently in one pass rather than fighting each other.

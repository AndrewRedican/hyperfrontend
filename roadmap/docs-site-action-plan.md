# Documentation Site Action Plan

Where the docs-site is heading: real engagement surfaces, richer per-package
content (FAQ, tutorials, skills), completed deep links into the codebase, and an
interactive "oracle". New content flows through the existing generation pipeline
so it ships with every build.

## Baseline (context, not work)

The work below builds on these existing pieces:

- **Docs generation pipeline** — `apps/docs-site/scripts/generate-docs.ts` ingests
  each library's `README.md` + `ARCHITECTURE.md`, runs TypeDoc over the entry
  points from `package.json` exports, rewrites markdown links to site routes, and
  emits `.generated/{docs,api,manifest.json}`. New content layers hook into this
  pipeline.
- **Bug-report URL helper** — `generateBugReportUrl()` in
  `src/lib/link-suggestions.ts` (currently only surfaced on the 404 page).
- **Tracked-link taxonomy** — outbound links route through `TrackedLink`
  (`src/components/analytics/tracked-link.tsx`) so engagement is measured under
  the campaign taxonomy; new outbound surfaces should join it.
- **Source deep links** — TypeDoc emits "View source" links per symbol. Linking
  targets the `main` branch deliberately (documented in `generate-docs.ts`:
  git detection is disabled so links are identical in every build environment);
  tag/commit pinning is explicitly not wanted.
- **Guides pipeline** — package-owned Guide Units (`libs/*/docs/guides/<slug>/`)
  compile through `scripts/generate-guides.ts` into the global `/docs/guides/[slug]`
  route with build-failing snippet extraction from executing specs and shipped demo
  sources. Documented in `apps/docs-site/README.md`.
- **Search** — a deterministic omni-search index over libraries, API symbols,
  submodules, guides, and articles is generated at build time to
  `public/search-index.json` behind the stable contract in
  `src/lib/search/search-contract.ts`; the client dialog (Ctrl/Cmd+K) consumes only
  that contract, so the producer can later be replaced by an indexer package.
- **Sharing + feed** — content pages carry a share menu (`src/components/share/`,
  descriptors centralized in `src/lib/share.ts`); articles are served as an Atom
  feed at `/feed.xml`.

---

## Phase 1: Engagement

### 1.1 Footer "Report an issue" link

Surface the existing `generateBugReportUrl()` helper in the footer (today it only
appears on the 404 page). The link should join the tracked-link taxonomy rather
than render as a plain anchor.

**Files:**

- `apps/docs-site/src/components/footer.tsx` — Edit

### 1.2 Social sharing links

Superseded by the shipped per-page share menu (`src/components/share/share-menu.tsx`:
native share sheet, LinkedIn, X, WhatsApp, copy link; analytics through the
`share` event). No footer share surface is planned.

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Phase 2: Complete source deep links

Implementation links shipped. Remaining scope: per-symbol deep links to **tests**
and **type/declaration** locations.

- Resolve test files by the repo's co-location/`*.spec.ts` convention; degrade
  gracefully when a target doesn't exist.
- Render the additional links in the API reference UI.

**Files:**

- `apps/docs-site/scripts/generate-docs.ts` — Edit (extract test/decl paths into
  the manifest)
- `apps/docs-site/src/components/api-reference/` — Edit (render deep links)

---

## Phase 3: Per-package FAQ

Author a FAQ per package, consumed by the generation pipeline so it ships in the
build (no manual page wiring).

- Define a standard location/format per package (e.g. `docs/FAQ.md` in each lib).
- Extend `generate-docs.ts` to discover and emit FAQ content into `.generated`
  and the manifest.
- Add a FAQ route/section to each library's docs page.

**Files:**

- `libs/*/docs/FAQ.md` — Create (per package)
- `apps/docs-site/scripts/generate-docs.ts` — Edit (ingest FAQ)
- `apps/docs-site/src/components/library-doc-page.tsx` — Edit (render FAQ)

---

## Phase 4: Per-package how-to tutorials

Settled and shipped as the Guide Unit system: `libs/*/docs/guides/<slug>/`
(`guide.md` + `meta.json`), compiled by `scripts/generate-guides.ts` into
`/docs/guides/[slug]`, with verified snippet extraction, a machine-readable corpus
at `/guides/index.json`, and per-library guide surfacing on library pages.
Mechanism documented in `apps/docs-site/README.md`.

Remaining scope is content, not infrastructure: an adoption-path tutorial or
how-to per package (the first wave shipped covers nexus and features), grown
consumer-problem-first rather than to per-package quotas.

---

## Phase 5: Ship SKILL.md with each package

Each package carries a `SKILL.md` (settle the standard/convention for shipping it
inside the published package), and the docs site surfaces it.

- Decide the convention: where `SKILL.md` lives in the package, whether it's
  included in the published tarball (`files`/exports), and how it's referenced.
- Pipeline ingestion into `.generated` + manifest.
- Render a "Skill" section per library in the site.

**Files:**

- `libs/*/SKILL.md` — Create (per package)
- `libs/*/package.json` — Edit (ensure SKILL.md is packaged)
- `apps/docs-site/scripts/generate-docs.ts` — Edit (ingest skills)
- `apps/docs-site/src/components/library-doc-page.tsx` — Edit (render skill)

---

## Phase 6: The Oracle

A local model, primed with the corpus the phases above produce (FAQ, SKILL.md,
tutorials, ARCHITECTURE, API), that docs-site visitors query: they describe a use
case and get back a tailored prompt / custom instructions.

- Feed it the generated corpus (FAQ + skills + tutorials + architecture + API).
- Expose an "ask the oracle" entry point in the docs site; visitor describes their
  use case → receives a generated prompt.
- _How_ (model choice, hosting, inference path) and _where_ it runs are deliberately
  left open — to be decided later. This phase is committed in scope; only the
  implementation details are deferred.

**Files:**

- TBD (corpus assembly likely extends `generate-docs.ts`; UI is a new docs-site
  surface)

---

## Phase 7: Accessibility (WCAG AA)

A skip-to-content link and initial contrast fixes have landed; the systematic
audit has not run.

- Run Lighthouse accessibility audit
- Fix colour contrast site-wide (code-block theming is in place, so the re-check
  can run now)
- Verify alt text on images
- Test keyboard navigation and focus indicators

**Files:**

- Various component files as needed

### Verification

```bash
npx nx build docs-site
npx lighthouse https://hyperfrontend.dev --only-categories=accessibility
```

---

## Deferred

| Item              | Reason                                                           |
| ----------------- | ---------------------------------------------------------------- |
| Algolia Search    | Declined permanently; deterministic local search shipped instead |
| Monaco Editor     | Requires `@monaco-editor/react`                                  |
| Usefulness Voting | Requires `@vercel/kv`                                            |
| Version Selector  | Lower priority                                                   |
| Versioned URLs    | Lower priority                                                   |

An articles Atom feed shipped at `/feed.xml` (hand-serialized, no `feed` package),
closing the earlier RSS deferral.

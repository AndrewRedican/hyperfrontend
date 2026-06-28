# Documentation Site Action Plan

Where the docs-site is heading: stronger SEO/branding, real engagement, richer
per-package content (FAQ, tutorials, skills), deep links into the codebase, an
interactive "oracle", and monetisation/analytics. Built on Next.js; new content
flows through the existing generation pipeline so it ships with every build.

## Status quo (context, not work)

These already exist and are assumed as the baseline the work below builds on:

- **Docs generation pipeline** — `apps/docs-site/scripts/generate-docs.ts` ingests
  each library's `README.md` + `ARCHITECTURE.md`, runs TypeDoc over the entry
  points from `package.json` exports, rewrites markdown links to site routes, and
  emits `.generated/{docs,api,manifest.json}`. New content layers below hook into
  this pipeline.
- **Breadcrumb component** — `src/components/breadcrumb.tsx`, already used across
  library/architecture pages.
- **Theme-aware SVG logos** — `public/hf-light.svg` / `public/hf-dark.svg`, wired
  into `layout.tsx` icon metadata.
- **Bug-report URL helper** — `generateBugReportUrl()` in
  `src/lib/link-suggestions.ts` (currently only surfaced on the 404 page).

---

## Phase 1: Branding assets

PNG icons and social cards (the SVG logos exist; the raster/social assets do not).

### 1.1 Favicon / raster icons

Convert from `assets/logo/hyperfrontend.png`.

**Files:**

- `apps/docs-site/src/app/favicon.ico` — Create (32x32)
- `apps/docs-site/src/app/icon.png` — Create (192x192)
- `apps/docs-site/src/app/apple-icon.png` — Create (180x180)

### 1.2 Open Graph / Twitter images

Metadata text is already configured in `layout.tsx`; the images are missing.

**Files:**

- `apps/docs-site/src/app/opengraph-image.png` — Create (1200x630)
- `apps/docs-site/src/app/twitter-image.png` — Create (1200x600)

### Verification

```bash
npx nx build docs-site
# Test with https://opengraph.xyz
```

---

## Phase 2: Structured data (JSON-LD)

No JSON-LD exists yet. The breadcrumb component is built — this only adds the
schema markup.

### 2.1 SoftwareApplication schema

Add JSON-LD script to root layout.

**Files:**

- `apps/docs-site/src/app/layout.tsx` — Edit

### 2.2 BreadcrumbList schema

Emit `BreadcrumbList` JSON-LD from the existing breadcrumb component.

**Files:**

- `apps/docs-site/src/components/breadcrumb.tsx` — Edit

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
# Test with https://search.google.com/test/rich-results
```

---

## Phase 3: Engagement

### 3.1 Footer "Report an issue" link

Surface the existing `generateBugReportUrl()` helper in the footer (today it only
appears on the 404 page).

**Files:**

- `apps/docs-site/src/components/footer.tsx` — Edit

### 3.2 Social sharing links

Twitter/LinkedIn share links (URL-based, no package).

**Files:**

- `apps/docs-site/src/components/share-buttons.tsx` — Create
- `apps/docs-site/src/components/footer.tsx` — Import and use

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Phase 4: Code-block theming

Code blocks currently render through plain `<pre><code>` with no syntax colouring
(`src/components/code-block.tsx` + `src/lib/markdown.ts` only attach a
`data-language` attribute). Introduce real, theme-aware highlighting.

- Add a highlighter (Shiki is already present transitively via TypeDoc) into the
  markdown pipeline so fenced blocks are tokenised at build time.
- Wire light/dark themes to the site's existing `theme-provider` so colours track
  the active theme instead of the hardcoded `text-slate-100`.
- Ensure copy-to-clipboard and the language label keep working post-highlight.

**Files:**

- `apps/docs-site/src/lib/markdown.ts` — Edit (highlight on processing)
- `apps/docs-site/src/components/code-block.tsx` — Edit (themed rendering)

### Verification

```bash
npx nx build docs-site
# Visually confirm light/dark code colours render correctly
```

---

## Phase 5: Deep linking to source artifacts

Make every documented symbol clickable through to the codebase. TypeDoc already
records source positions per symbol — surface them.

- For each API symbol, generate deep links to GitHub for its **implementation**,
  **tests**, and **type/declaration** locations (pinned to the published tag/commit,
  not a moving branch).
- Resolve test files by the repo's co-location/`*.spec.ts` convention; degrade
  gracefully when a target doesn't exist.
- Render the links in the API reference UI.

**Files:**

- `apps/docs-site/scripts/generate-docs.ts` — Edit (extract source/test/decl paths
  into the manifest)
- `apps/docs-site/src/components/api-reference/` — Edit (render deep links)

---

## Phase 6: Per-package FAQ

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

## Phase 7: Per-package how-to tutorials

Task-oriented "how to" guides per package, ingested the same way as FAQ.

- Standard location/format per package (e.g. `docs/tutorials/*.md`).
- Pipeline discovery + manifest entries; multiple tutorials per package.
- Tutorial index + pages per library in the site.

**Files:**

- `libs/*/docs/tutorials/*.md` — Create (per package)
- `apps/docs-site/scripts/generate-docs.ts` — Edit (ingest tutorials)
- `apps/docs-site/src/components/library-doc-page.tsx` — Edit (render tutorials)

---

## Phase 8: Ship SKILL.md with each package

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

## Phase 9: The Oracle

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

## Phase 10: Analytics & ads (Google)

Wire Google Analytics and Google ads into the site.

- Google Analytics (GA4) via `next/script`, gated on production + consent.
- Google AdSense/ad slots placed so they don't degrade docs readability or CLS.
- Add a lightweight consent/cookie notice as required.

**Files:**

- `apps/docs-site/src/app/layout.tsx` — Edit (GA + AdSense scripts)
- `apps/docs-site/src/components/` — Create (ad slot + consent components)

---

## Phase 11: Accessibility (WCAG AA)

- Run Lighthouse accessibility audit
- Fix colour contrast (re-check after Phase 4 code theming and Phase 10 ad slots)
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

| Item              | Reason                          |
| ----------------- | ------------------------------- |
| Algolia Search    | Not using Algolia               |
| Monaco Editor     | Requires `@monaco-editor/react` |
| Usefulness Voting | Requires `@vercel/kv`           |
| RSS Feed          | Requires `feed` package         |
| Version Selector  | Lower priority                  |
| Versioned URLs    | Lower priority                  |

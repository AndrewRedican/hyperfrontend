# HyperFrontend Documentation Site

Next.js documentation site for the HyperFrontend framework, deployed at [hyperfrontend.dev](https://hyperfrontend.dev).

---

## Quick Start

```bash
# Run all commands from the app directory (scripts resolve against its package.json)
cd apps/docs-site

# Install dependencies (self-contained node_modules; required once)
npm install

# Generate documentation content
npm run generate

# Build for production
npm run build

# Start the production server (http://localhost:3000)
npm run start
```

### Troubleshooting Local Development

Run the commands from `apps/docs-site`, not the repo root — `npm run` resolves
scripts against the current directory's `package.json`. If the server behaves
unexpectedly, rebuild before starting:

```bash
npm run build && npm run start
```

---

## Architecture Overview

The docs-site is a **Next.js 15 App Router** application with Tailwind CSS. Content is generated from source files across the monorepo at build time.

```
apps/docs-site/
├── .generated/              # Auto-generated content (gitignored)
│   ├── api/                 # TypeDoc JSON for each library
│   ├── docs/                # Extracted README.md and ARCHITECTURE.md
│   └── manifest.json        # Library metadata and generation status
├── scripts/
│   ├── generate-docs.ts     # Content generation pipeline
│   └── validate-links.ts    # Build-time link validation
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── components/          # React components
│   │   ├── api-reference/   # TypeDoc JSON rendering components
│   │   ├── mermaid-diagram.tsx
│   │   ├── library-doc-page.tsx
│   │   └── ...
│   └── lib/                 # Utilities
│       ├── docs-loader.ts   # Content loading functions
│       ├── markdown.ts      # Markdown → HTML conversion
│       └── mermaid-utils.ts # Mermaid extraction
└── public/                  # Static assets
```

---

## Content Generation Pipeline

Documentation is automatically extracted from the monorepo via `npm run generate`:

Two kinds of source feed it. Package documentation (`README.md`, `ARCHITECTURE.md`, API
types) is read out of the libraries, because a package owns the description of itself.
Authored long-form documentation lives here instead, under `content/`:

```text
content/
  articles/      one markdown file per article, frontmatter-classified
  guides/        one directory per guide, guide.md + meta.json
```

That is the whole answer to where a new article or a new guide goes. Editorial content
is a consumer of the packages, so it never lives inside a publishable project: a change
under `content/` affects this site and nothing else.

### What Gets Generated

| Content Type          | Source                                    | Output                                                   |
| --------------------- | ----------------------------------------- | -------------------------------------------------------- |
| **API Reference**     | TypeScript source files                   | `.generated/api/{lib}/api.json`                          |
| **README**            | `libs/*/README.md`, `plugins/*/README.md` | `.generated/docs/{lib}/readme.md`                        |
| **Architecture**      | `libs/*/ARCHITECTURE.md`                  | `.generated/docs/{lib}/architecture.md`                  |
| **Root Architecture** | `ARCHITECTURE.md`                         | `.generated/docs/architecture.md`                        |
| **Contributing**      | `CONTRIBUTING.md`                         | `.generated/docs/contributing.md`                        |
| **Guides**            | `content/guides/{slug}/`                  | `.generated/guides/{slug}/guide.md`, `guides/index.json` |
| **Search index**      | Everything above + articles + navigation  | `public/search-index.json`                               |

### Entry Point Discovery

Entry points for TypeDoc are **automatically discovered** from each library's `package.json` exports field:

```json
// libs/cryptography/package.json
{
  "exports": {
    "./browser": "./src/browser/index.js",
    "./node": "./src/node/index.js"
  }
}
// → Discovers: src/browser/index.ts, src/node/index.ts
```

No hardcoded configuration needed — add exports to `package.json` and the docs pipeline will pick them up.

### Link Transformation

Links in markdown content are automatically transformed for the docs site:

| Pattern                      | Transformation          |
| ---------------------------- | ----------------------- |
| `./README.md`                | `/`                     |
| `./ARCHITECTURE.md`          | `/docs/architecture`    |
| `libs/nexus/ARCHITECTURE.md` | `/docs/libraries/nexus` |
| `roadmap/*.md`               | GitHub blob URL         |

### Guides (Guide Units)

Guides are editorial content owned by this site, not by the packages they describe. A
guide unit is a directory `content/guides/<slug>/` holding `guide.md` plus `meta.json`
(schema: `scripts/generate-guides.types.ts`). A guide may explain
`@hyperfrontend/features`, use its APIs, and link to its reference pages without living
inside that package: association is declared in `meta.json` via `packages`, whose first
entry is the package the guide is primarily about and whose remaining entries let a
cross-cutting guide name every package it involves. Every entry must be a documented
package or the build fails. Nothing about a guide belongs in a publishable project tree,
so editing one cannot mark a library changed for Nx, CI, versioning, or publishing.

Slugs are global and flat: the directory name is the URL. Grouping folders are
deliberately absent, because `meta.json` already carries the taxonomy the site filters
and sorts on.

The compiler
(`scripts/generate-guides.ts`) validates metadata, resolves every
`<!-- snippet: region -->` placeholder from `// ref: [guide:<slug>/<region>] start|end`
marker regions inside the shipped source named by `verification.source` (plus optional
`snippetSources`), and fails the build on any malformed unit, dangling placeholder,
orphaned region, or slug collision.

Two verification lanes, both stated on the page so a reader knows what a code block is
worth:

| Lane       | Meaning                                                                                                                                     | `meta.json` requires                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `demo`     | Snippets are extracted from source that ships and runs for its own reasons (a demo app, the docs-site gallery), so they cannot silently rot | `source` (+ optional `snippetSources`) |
| `authored` | Code is written in the guide and was executed against a published package while writing                                                     | `verifiedAgainst`, `verifiedOn`        |

No test files exist to back documentation. The `authored` lane records the package
version and the date the examples were run, and the page renders both, so drift is
visible rather than hidden. Guide examples are never verified by adding specs to the
repository.

Outputs: `.generated/guides/<slug>/guide.md` (rendered at `/docs/guides/<slug>`),
`.generated/guides/index.json`, and a public machine-readable copy at
`/guides/index.json`. Library pages surface their guides from that index; there is no
hand-maintained guide registry.

#### One filtered destination, many entry points

`/docs/guides/` is the only guides destination, and both of its facets live in the query
string: `?package=<npm package name>` and `?type=<tutorial|how-to|troubleshooting|recipe>`.
The semantics are defined once in [src/lib/guide-filters.ts](src/lib/guide-filters.ts) and
every consumer goes through it: the index page's own controls, the landing page's learning
cards, each library page's guides link, and `getGuidesForPackage`, which library pages use
to list a package's guides. There is no second filtering implementation and no
package-to-guide table: association comes from each unit's `meta.json` `packages`, and the
selectable package list comes from the documentation manifest, so a package with no guides
yet is still a valid, shareable filter.

Published package READMEs link the same URL
(`https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2F<name>`), enforced
by the `lib-readme-structure` ESLint rule against `package.json`'s `name`. Because the link
addresses a filter rather than guide slugs, it is correct before a package has any guides
and begins surfacing them the moment they ship, with no README change.

A filtered view with no results is a deliberate empty state, not an error: it names the
package and offers a prefilled guide request against the `guide_request.yml` issue form
(`src/lib/guide-request.ts`), using GitHub's own field-prefill query parameters. A populated
view carries the same request as a quieter secondary action.

Fast authoring loop (skips TypeDoc):

```bash
npm run generate:guides
```

### Search index

`scripts/generate-search-index.ts` compiles a deterministic omni-search index (libraries,
API symbols, submodules, guides, articles, architecture pages, and their section anchors)
into `public/search-index.json`. The serialized shape is the contract in
`src/lib/search/search-contract.ts`; the client (`src/components/search/search-dialog.tsx`,
Ctrl/Cmd+K) fetches it lazily and matches with exact substring AND semantics via
`src/lib/search/search-engine.ts`. The producer is replaceable: a future
`@hyperfrontend/indexer` can emit the same contract without touching the consumer.
Section anchors reproduce the page's own id algorithm (`src/lib/slug.ts`), so every
search destination resolves.

### Articles taxonomy and feed

Article frontmatter stays flat quoted scalars; list-valued fields are comma-separated
inside one quoted value (`tags`, `packages`, `related`), plus scalar `category` and
`updated`. The loader (`src/lib/articles.ts`) parses lists; unknown related slugs fail
the static build. Articles are served as an Atom feed at `/feed.xml`
(`src/lib/feed.ts` + `src/app/feed.xml/route.ts`), advertised via the layout's
`alternates.types`.

### Sharing

One share implementation serves every reader-facing page: `src/lib/share.ts` composes the
canonical URL and share text, `src/components/share/share-menu.tsx` renders the control, and
`src/components/share/share-icons.tsx` holds the destination brand marks as inline SVG so a
handful of icons costs no dependency and no extra request. Articles, how-to guides, and
tutorials mount the same component with their own title and page line, so the experience does
not depend on which kind of page the reader is on. Every mark is decorative and paired with a
visible label.

---

## Libraries Documented

All 16 library packages generate TypeDoc API documentation:

| Library                | Package Name                            | Entry Points | Category   |
| ---------------------- | --------------------------------------- | ------------ | ---------- |
| Nexus                  | `@hyperfrontend/nexus`                  | 1            | core       |
| Network Protocol       | `@hyperfrontend/network-protocol`       | 18           | core       |
| Cryptography           | `@hyperfrontend/cryptography`           | 3            | core       |
| State Machine          | `@hyperfrontend/state-machine`          | 11           | supporting |
| Logging                | `@hyperfrontend/logging`                | 1            | supporting |
| Web Worker             | `@hyperfrontend/web-worker`             | 1            | supporting |
| Data Utils             | `@hyperfrontend/data-utils`             | 1            | utils      |
| Function Utils         | `@hyperfrontend/function-utils`         | 1            | utils      |
| Immutable API Utils    | `@hyperfrontend/immutable-api-utils`    | 1            | utils      |
| JSON Utils             | `@hyperfrontend/json-utils`             | 1            | utils      |
| List Utils             | `@hyperfrontend/list-utils`             | 1            | utils      |
| Random Generator Utils | `@hyperfrontend/random-generator-utils` | 1            | utils      |
| String Utils           | `@hyperfrontend/string-utils`           | 2            | utils      |
| Time Utils             | `@hyperfrontend/time-utils`             | 1            | utils      |
| UI Utils               | `@hyperfrontend/ui-utils`               | 10           | utils      |
| Features               | `@hyperfrontend/features`               | 5            | core       |

---

## Adding a New Library

1. **Add entry to `LIBRARIES` array** in [scripts/generate-docs.ts](scripts/generate-docs.ts):

   ```typescript
   {
     name: 'My Library',
     packageName: '@hyperfrontend/my-library',
     slug: 'my-library',
     srcPath: 'libs/my-library',
     category: 'core',
   }
   ```

2. **Create page** under `src/app/docs/libraries/*/page.tsx`:

   ```tsx
   import { LibraryDocPage } from '@/components/library-doc-page'

   export default function MyLibraryPage() {
     return <LibraryDocPage title="My Library" packageName="@hyperfrontend/my-library" slug="my-library" category="core" />
   }
   ```

3. **Add to navigation** in [src/components/sidebar.tsx](src/components/sidebar.tsx)

4. **Ensure `package.json` has exports** — entry points are auto-discovered

---

## Mermaid Diagrams

Mermaid diagrams in README.md and ARCHITECTURE.md files are rendered client-side:

1. `extractMermaidBlocks()` extracts diagram code during server rendering
2. Placeholder divs are inserted in the HTML
3. `<MermaidDiagram>` component renders diagrams on the client

The mermaid library is initialized with a custom theme matching the site's design.

---

## Key Components

| Component        | Purpose                                                       |
| ---------------- | ------------------------------------------------------------- |
| `LibraryDocPage` | Main library documentation layout with README + API reference |
| `ApiReference`   | Renders TypeDoc JSON with search/filter                       |
| `ReadmeContent`  | Renders markdown HTML with mermaid diagram injection          |
| `MermaidDiagram` | Client-side mermaid rendering                                 |
| `Sidebar`        | Navigation tree                                               |
| `Breadcrumb`     | Page location indicator                                       |

### API Reference Components

| Component                 | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `api-search-filter.tsx`   | Search input and type filter toggles                  |
| `function-signature.tsx`  | Function/method display                               |
| `type-definition.tsx`     | Interface/type alias display                          |
| `module-grouped-view.tsx` | Module-grouped API display for multi-entry-point libs |
| `copy-button.tsx`         | Copy-to-clipboard functionality                       |

---

## Build Process

```bash
npm run build
```

This runs:

1. `npm run generate` — Generate TypeDoc and extract markdown
2. `npm run validate-links` — Check for broken internal links
3. `next build` — Build the Next.js application

### Link Validation

The `validate-links.ts` script scans `.generated/**`, workspace-root `*.md`, `libs/**/*.md`,
and `content/**` (articles) during build and fails on broken internal links. Site-absolute
asset links resolve against `public/` as well as `src/app` routes.

---

## URL Structure

| URL Pattern                     | Content                       |
| ------------------------------- | ----------------------------- |
| `/`                             | Landing page                  |
| `/docs`                         | Getting Started               |
| `/docs/quick-start`             | Quick Start guide             |
| `/docs/core-concepts`           | Core Concepts                 |
| `/docs/guides`                  | Guides index (problem-first)  |
| `/docs/guides/?package={pkg}`   | Guides filtered to a package  |
| `/docs/guides/?type={type}`     | Guides filtered to a type     |
| `/docs/guides/{slug}`           | One compiled guide            |
| `/docs/libraries/{slug}`        | Library documentation         |
| `/docs/libraries/utils/{slug}`  | Utils package documentation   |
| `/docs/contributing`            | Contribution guide            |
| `/docs/api`                     | API Reference index           |
| `/architecture`                 | Architecture overview         |
| `/articles`, `/articles/{slug}` | Articles (canonical copies)   |
| `/feed.xml`                     | Articles Atom feed            |
| `/guides/index.json`            | Machine-readable guide corpus |
| `/search-index.json`            | Serialized search index       |

---

## Deployment

Deployed to **Vercel** with automatic deployments on push to `main`.

### Environment

- Next.js 15
- React 19
- Tailwind CSS 3.4
- TypeDoc 0.28

### Build Output

Static export to `out/` directory for Vercel deployment.

---

## Analytics & SEO

### Google Analytics (GA4, Google Ads-ready)

Analytics lives in [src/lib/analytics.ts](src/lib/analytics.ts) and the `<Analytics />` component mounted from the root layout. It renders **nothing** unless `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set at build time — that env var is the production gate: it is configured only in the production Vercel environment, so development and preview builds ship zero analytics code.

| Env var                                | Purpose                                                               |
| -------------------------------------- | --------------------------------------------------------------------- |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`        | GA4 measurement ID (`G-…`). Setting it enables analytics.             |
| `NEXT_PUBLIC_GOOGLE_ADS_ID`            | Optional Google Ads account ID (`AW-…`) enabling conversion tracking. |
| `NEXT_PUBLIC_SITE_URL`                 | Canonical origin override; defaults to `https://hyperfrontend.dev`.   |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Optional Google Search Console verification token.                    |

### Consent Mode v2, basic mode

Measurement is consent-gated end to end. The inline bootstrap queues the Consent Mode v2 signals (`analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`) as `denied` before anything else can run, and — the _basic-mode_ point — gtag.js itself is only added to the page after the visitor grants an optional category, so before consent there are no Google requests at all, not even cookieless pings. The provider-agnostic consent model lives in [src/lib/consent/consent.ts](src/lib/consent/consent.ts) (categories `necessary` / `analytics` / `advertising`, persisted as the single `hf-consent` localStorage key); the Google adapter mapping those categories onto the v2 signal fields is [src/lib/consent/google-consent.ts](src/lib/consent/google-consent.ts); the banner and preferences dialog are `<ConsentBanner />`, which renders only when a measurement ID is configured — a dormant integration shows no banner, and configuring an ID activates the consent experience automatically. The optional-category default is denied for every visitor worldwide: no region-resolution mechanism exists, and browser locale is not a legal jurisdiction, so the conservative default applies globally. The footer's **Privacy settings** control reopens the dialog at any time; withdrawing pushes a denied consent update and stops future optional collection. What the visitor sees is documented on [/privacy](src/app/privacy/page.tsx), which is written against this implementation.

Page views are reported manually (`send_page_view: false`): the route tracker fires each path's `page_view` exactly once — on load, on every App Router navigation, or the moment analytics consent arrives mid-visit — and never before the analytics grant.

### Recording events and conversions

Product events are **centralized** in [src/lib/analytics-events.ts](src/lib/analytics-events.ts) — a deliberately small campaign taxonomy (`demo_open`, `docs_cta`, `repo_visit`, `npm_visit`) limited to interactions that exist today, carrying only fixed public identifiers (slugs, package names, link locations), deduped per page life for demo opens, and consent-gated through `trackEvent`. Components report through the taxonomy helpers or the `<TrackedLink>` primitive rather than calling `gtag` directly; the embedded demo apps ship no analytics of their own, so the host is the single reporter and no session double-counts.

```ts
import { trackConversion, trackEvent } from '@/lib/analytics'

// GA4 event, attributed to the current page — silently dropped until the visitor grants analytics
trackEvent('select_content', { content_type: 'demo', item_id: 'clock' })

// Google Ads conversion — the label comes from the Ads tag setup UI; requires the advertising grant
trackConversion('AbC-D_efGhIjKlMnOp', { value: 1, currency: 'USD' })
```

Both helpers no-op when analytics is not configured, so call sites never need environment guards.

### Sitemap coverage guard

`npm run validate-sitemap` (part of `npm run build`) enumerates every static `src/app/**/page.tsx` route and fails the build when one is missing from `sitemap.xml`. Pages the sidebar navigation does not link must be added to the static list in [src/app/sitemap.ts](src/app/sitemap.ts); deliberate exclusions go in the commented allowlist in [scripts/validate-sitemap.ts](scripts/validate-sitemap.ts).

---

## Roadmap

For planned features and pending work, see the [documentation roadmap](../../roadmap/docs-site-action-plan.md).

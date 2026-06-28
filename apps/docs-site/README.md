# HyperFrontend Documentation Site

Next.js documentation site for the HyperFrontend framework, deployed at [hyperfrontend.dev](https://www.hyperfrontend.dev).

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

### What Gets Generated

| Content Type          | Source                                    | Output                                  |
| --------------------- | ----------------------------------------- | --------------------------------------- |
| **API Reference**     | TypeScript source files                   | `.generated/api/{lib}/api.json`         |
| **README**            | `libs/*/README.md`, `plugins/*/README.md` | `.generated/docs/{lib}/readme.md`       |
| **Architecture**      | `libs/*/ARCHITECTURE.md`                  | `.generated/docs/{lib}/architecture.md` |
| **Root Architecture** | `ARCHITECTURE.md`                         | `.generated/docs/architecture.md`       |
| **Contributing**      | `CONTRIBUTING.md`                         | `.generated/docs/contributing.md`       |

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

The `validate-links.ts` script checks all internal links during build and reports broken links as warnings.

---

## URL Structure

| URL Pattern                    | Content                     |
| ------------------------------ | --------------------------- |
| `/`                            | Landing page                |
| `/docs`                        | Getting Started             |
| `/docs/quick-start`            | Quick Start guide           |
| `/docs/core-concepts`          | Core Concepts               |
| `/docs/libraries/{slug}`       | Library documentation       |
| `/docs/libraries/utils/{slug}` | Utils package documentation |
| `/docs/contributing`           | Contribution guide          |
| `/docs/api`                    | API Reference index         |
| `/architecture`                | Architecture overview       |

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

## Roadmap

For planned features and pending work, see the [documentation roadmap](../../roadmap/docs-site-action-plan.md).

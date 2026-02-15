# Documentation Strategy & Vision

A comprehensive plan for first-class documentation of the HyperFrontend microfrontend framework.

---

## Table of Contents

- [Documentation Strategy \& Vision](#documentation-strategy--vision)
  - [Table of Contents](#table-of-contents)
  - [Executive Summary](#executive-summary)
  - [Current State](#current-state)
    - [Codebase Documentation](#codebase-documentation)
    - [Infrastructure \& Assets](#infrastructure--assets)
    - [Known Limitations](#known-limitations)
  - [Vision \& End Goals](#vision--end-goals)
    - [Guiding Principles](#guiding-principles)
    - [Target Experience](#target-experience)
  - [Requirements](#requirements)
    - [Architecture \& Technology](#architecture--technology)
    - [Search \& Discovery](#search--discovery)
    - [Versioning System](#versioning-system)
    - [Content Organization](#content-organization)
    - [Interactive Features](#interactive-features)
    - [User Engagement](#user-engagement)
    - [Visual Design \& Branding](#visual-design--branding)
    - [Link Management](#link-management)
    - [Automation \& Extraction](#automation--extraction)
  - [Monorepo Considerations](#monorepo-considerations)
    - [Project Inventory](#project-inventory)
    - [Documentation Complexity](#documentation-complexity)
  - [Success Criteria](#success-criteria)
    - [User-Facing](#user-facing)
    - [Developer-Facing (Maintainer)](#developer-facing-maintainer)
    - [Business/Project](#businessproject)
  - [Out of Scope](#out-of-scope)
  - [Resolved Decisions](#resolved-decisions)
    - [Technical Decisions](#technical-decisions)
    - [Process Decisions](#process-decisions)
    - [Design Decisions](#design-decisions)
  - [Implementation Roadmap](#implementation-roadmap)
  - [Related Documentation](#related-documentation)
    - [Internal](#internal)
    - [Project Documentation](#project-documentation)
    - [External References](#external-references)

---

## Executive Summary

HyperFrontend is an Nx-managed monorepo containing 14+ projects that together form a complete microfrontend framework. Each library is independently publishable to npm while participating in a layered architecture for secure, contract-validated cross-window communication.

The documentation challenge is twofold:

1. **Standalone clarity** — Each library must be documented as a self-sufficient tool
2. **Ecosystem coherence** — The libraries' relationships and combined value must be visible

This document defines what exists today, what the end-state should look like, and the requirements to bridge the gap.

---

## Current State

### Codebase Documentation

**What exists and is well-maintained:**

| Asset                  | Coverage     | Notes                                                                                |
| ---------------------- | ------------ | ------------------------------------------------------------------------------------ |
| JSDoc comments         | 100%         | Every exported function, type, and class is documented with proper TypeScript typing |
| `@remarks` annotations | Extensive    | Contextual explanations throughout                                                   |
| `@example` annotations | Extensive    | Inline code examples in JSDoc                                                        |
| Unit tests             | 98% coverage | Well-designed tests that serve as usage examples                                     |
| README.md files        | All projects | Rich multi-level documentation with badges, architecture highlights                  |
| ARCHITECTURE.md files  | Key projects | Deep dives into internal design                                                      |
| Mermaid diagrams       | Throughout   | Visual architecture documentation embedded in markdown                               |
| ASCII art diagrams     | Throughout   | Text-based visual explanations                                                       |

**Project README.md quality indicators:**

- npm badges (version, downloads, bundle size)
- CI status badges linked to GitHub Actions
- CodeCov coverage badges per project
- Clear "What is this?" sections
- "Key Features" and "Architecture Highlights" sections
- Links to full architecture documentation

### Infrastructure & Assets

| Asset              | Status       | Details                                                                                                                   |
| ------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Domain             | ✓ Secured    | [hyperfrontend.dev](https://www.hyperfrontend.dev) — 10-year registration                                                 |
| Hosting            | ✓ Active     | [GitHub Pages](https://pages.github.com/) (current placeholder)                                                           |
| Hugo site          | ✓ Functional | [Hextra theme](https://imfing.github.io/hextra/), basic navigation, rudimentary content                                   |
| Logo               | ✓ Available  | [`assets/logo/hyperfrontend.png`](../assets/logo/hyperfrontend.png) — symbol + wordmark                                   |
| Tailwind templates | ✓ Licensed   | 11 commercial templates in [`_/commercial-develop/templates/`](../_/commercial-develop/templates/)                        |
| CI/CD pipeline     | 95% complete | Automated build, test, and release workflows via [GitHub Actions](https://github.com/AndrewRedican/hyperfrontend/actions) |
| GitHub releases    | ✓ Active     | [Tagged releases](https://github.com/AndrewRedican/hyperfrontend/releases) with conventional commit messages              |
| TypeDoc            | Familiar     | Experience with configuration; limitations understood                                                                     |

**Available Tailwind Templates:**

| Template      | Potential Use            |
| ------------- | ------------------------ |
| `syntax`      | API documentation        |
| `protocol`    | Technical docs / landing |
| `primer`      | Landing page             |
| `spotlight`   | Project showcase         |
| `salient`     | Marketing / landing      |
| `keynote`     | Presentations            |
| `pocket`      | Compact layouts          |
| `transmit`    | Communication theme      |
| `d-board`     | Dashboard layouts        |
| `express-app` | Application layouts      |
| `tslib`       | Library documentation    |

**Note:** Templates are fully paid but require reimagining to avoid copyright issues. No carbon-copying; no website generation services or template resale.

### Known Limitations

| Limitation                 | Impact                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| Hugo site is a placeholder | Not representative of project quality                            |
| No search functionality    | Users can't find content except by manual navigation             |
| No versioned documentation | Users can't match docs to their installed package version        |
| No SEO optimization        | Poor discoverability via search engines                          |
| GitHub-only links          | Project README.md files link to GitHub, not a documentation site |
| Relative markdown links    | Internal links only work locally or on GitHub                    |
| Single logo format         | Only PNG; no symbol-only variant; no animations                  |
| No mobile optimization     | Current Hugo site lacks responsive polish                        |
| No interactive code views  | Static code blocks only                                          |

---

## Vision & End Goals

### Guiding Principles

1. **Automation First (90%+ automated)**
   - Documentation regenerates automatically on release
   - Manual effort reserved for guides, tutorials, and conceptual content
   - Full reconstruction possible from Git tags/releases alone

2. **Developer Experience**
   - API documentation mirrors monorepo structure
   - Clear visual distinction between internal APIs, external APIs, utilities, and plugins
   - Dense, scannable text layout to minimize scrolling

3. **User Experience**
   - No login required — zero barriers to access
   - Mobile-first, fully responsive design
   - Fast page loads (< 2 seconds)
   - Everything bookmarkable and shareable

4. **Discoverability**
   - SEO-optimized for organic search traffic
   - Multiple search modalities: fuzzy search, keyword search, hierarchical navigation
   - Deep linking to any section, API, or subsection

### Target Experience

**Inspirations:**

- [MDN Web Docs](https://developer.mozilla.org/) (depth, search, structure)
- [Wikipedia](https://en.wikipedia.org/) (linking density, navigation)
- [Can I Use](https://caniuse.com/) (quick answers, visual clarity)
- [TypeDoc](https://typedoc.org/)/[Docusaurus](https://docusaurus.io/) (API documentation patterns)
- [Algolia-powered sites](https://docsearch.algolia.com/) (search experience)

**End-user journey:**

1. Search engine leads to relevant API or guide page
2. Fuzzy search finds specific APIs quickly
3. Version selector matches their installed package
4. Cross-references make ecosystem connections clear
5. Shareable links work permanently across versions

---

## Requirements

### Architecture & Technology

**Frontend Stack:**

| Choice                                   | Rationale                                          |
| ---------------------------------------- | -------------------------------------------------- |
| [React](https://react.dev/)              | Primary frontend preference; ecosystem familiarity |
| [Next.js](https://nextjs.org/)           | SEO optimization (SSR/SSG), React meta-framework   |
| [Tailwind CSS](https://tailwindcss.com/) | Design system from licensed templates              |
| [Vercel](https://vercel.com/)            | Hosting with excellent Next.js integration         |

**Documentation Generation:**

| Tool                            | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| [TypeDoc](https://typedoc.org/) | API extraction from TypeScript/JSDoc              |
| Custom scripts                  | README/ARCHITECTURE extraction and transformation |
| Markdown processing             | Link transformation, content enrichment           |

**Search & Indexing:**

| Capability      | Approach                                            |
| --------------- | --------------------------------------------------- |
| Fuzzy search    | [Algolia DocSearch](https://docsearch.algolia.com/) |
| Keyword search  | Built-in via Algolia                                |
| Tree navigation | Custom hierarchical index component                 |

### Search & Discovery

**Multi-modal search system:**

| Search Mode             | Description                            | Priority |
| ----------------------- | -------------------------------------- | -------- |
| Fuzzy search            | AI-powered semantic matching (Algolia) | High     |
| Keyword search          | Traditional exact-match search         | High     |
| Hierarchical navigation | Tree-based project/API browsing        | High     |
| Search suggestions      | Autocomplete with popularity weighting | Medium   |

**Search result ranking:**

- Primary: algorithmic relevance (keyword/fuzzy match quality)
- Secondary: page visit frequency / popularity metrics
- Tertiary: user voting signal (IP-based "usefulness" votes)

**SEO requirements:**

- Clean, semantic HTML structure
- Proper meta tags and Open Graph data
- Sitemap generation
- Fast Core Web Vitals scores
- Structured data for rich search results

### Versioning System

**Core capabilities:**

| Requirement          | Description                                              |
| -------------------- | -------------------------------------------------------- |
| Multi-version access | Documentation for all published versions accessible      |
| Version switching    | Easy navigation between versions from any page           |
| Permanent URLs       | Versioned URLs that never break                          |
| Version pinning      | Users can find docs matching their installed version     |
| Static asset storage | Each version's assets stored durably                     |
| Reconstruction       | Ability to regenerate any version from Git tags/releases |

**Recovery strategy:**

- Git tags and GitHub releases serve as source of truth
- Documentation can be fully reconstructed for any tagged version
- Accidental deletion of built assets is recoverable

### Content Organization

**Information architecture ([Diataxis](https://diataxis.fr/)-inspired, not rigid):**

| Category            | Content Type                            | Generation                     |
| ------------------- | --------------------------------------- | ------------------------------ |
| **Getting Started** | Tutorials, quick start guides           | Manual + automated             |
| **Guides**          | How-to articles, problem-solution pairs | Manual                         |
| **API Reference**   | TypeDoc-generated documentation         | Automated                      |
| **Architecture**    | Design decisions, patterns, concepts    | Manual + extracted             |
| **Examples**        | Code samples, recipes                   | Automated from tests + manual  |
| **Demos**           | Links to running demo applications      | Manual                         |
| **Contributing**    | Contribution guidelines, setup          | Extracted from CONTRIBUTING.md |

**Monorepo navigation structure:**

```
Documentation
├── Getting Started
├── Core Libraries
│   ├── @hyperfrontend/nexus
│   ├── @hyperfrontend/network-protocol
│   ├── @hyperfrontend/cryptography
│   ├── @hyperfrontend/state-machine
│   ├── @hyperfrontend/logging
│   └── @hyperfrontend/web-worker
├── Utility Libraries
│   ├── @hyperfrontend/utils/data
│   ├── @hyperfrontend/utils/function
│   ├── @hyperfrontend/utils/immutable-api
│   ├── @hyperfrontend/utils/list
│   ├── @hyperfrontend/utils/random-generator
│   ├── @hyperfrontend/utils/string
│   ├── @hyperfrontend/utils/time
│   └── @hyperfrontend/utils/ui
├── Plugins
│   └── @hyperfrontend/features (Nx plugin)
├── Demos
│   ├── Chess
│   ├── Clock
│   ├── Events
│   ├── File Share
│   ├── Heartbeat
│   └── Views
├── Architecture
│   └── How the pieces fit together
└── Contributing
```

**Visual differentiation:**

- Distinct color palette for internal vs. external APIs
- Visual markers for stability (stable, experimental, deprecated)
- Library layer indicators (Foundation, Security, Communication, Tooling)

### Interactive Features

**Code presentation:**

| Feature                                                     | Description                                            | Priority |
| ----------------------------------------------------------- | ------------------------------------------------------ | -------- |
| [Monaco editor](https://microsoft.github.io/monaco-editor/) | Read-only embedded code views with syntax highlighting | High     |
| Copy to clipboard                                           | One-click code copying                                 | High     |
| Syntax highlighting                                         | Framework-appropriate highlighting                     | High     |
| Collapsible sections                                        | Dense but navigable code examples                      | Medium   |

**Interactive elements:**

- Read-only [Monaco](https://microsoft.github.io/monaco-editor/) views for TypeScript/JavaScript code
- [Mermaid](https://mermaid.js.org/) diagram rendering (already in markdown)
- ASCII art preservation in code blocks
- Expandable/collapsible API details

### User Engagement

**Feedback mechanisms:**

| Feature             | Implementation                                     |
| ------------------- | -------------------------------------------------- |
| Usefulness voting   | IP-based thumbs up/down per page                   |
| Issue reporting     | "Suggest improvement" → GitHub issue (auto-tagged) |
| Popularity tracking | Page visit frequency for search ranking            |

**Social sharing:**

- Share buttons: Twitter/X, LinkedIn, Reddit
- RSS feeds for updates/releases
- Open Graph meta tags for rich previews

**Documentation issues:**

- "Report an issue" link on every page
- Automated GitHub issue creation with:
  - URL of documentation page
  - "documentation-improvement" label
  - Template for user feedback

### Visual Design & Branding

**Design system:**

| Requirement           | Details                                          |
| --------------------- | ------------------------------------------------ |
| Tailwind-based        | Leverage licensed templates, reimagined          |
| Responsive            | Mobile-first, works on all devices               |
| Dark/light modes      | Theme switching support                          |
| Dense text layout     | Maximize information density, minimize scrolling |
| Consistent typography | Clear hierarchy, readable fonts                  |

**Branding assets needed:**

| Asset           | Current | Needed                          |
| --------------- | ------- | ------------------------------- |
| Logo + wordmark | ✓ PNG   | SVG, PNG, JPEG versions         |
| Symbol only     | ✗       | New asset (no text)             |
| Favicon         | ✗       | Multiple ICO sizes, webmanifest |
| Animations      | ✗       | Logo animation, loading states  |
| Social cards    | ✗       | Open Graph images               |

**Animation considerations:**

- Logo entrance/transition animations
- Loading state with logo-based animation
- Subtle micro-interactions
- Performance-conscious (no heavy JS animations)

### Link Management

**URL transformation requirements:**

| Link Type                | Current Form                           | Target Form                             |
| ------------------------ | -------------------------------------- | --------------------------------------- |
| Top-level README links   | `https://github.com/.../blob/main/...` | `https://hyperfrontend.dev/...`         |
| Workspace-relative links | `./path/to/file.md`                    | `https://hyperfrontend.dev/...`         |
| Cross-project references | `../../libs/nexus/README.md`           | `https://hyperfrontend.dev/libs/nexus/` |

**Link integrity:**

- Automated link validation during build
- Broken link detection and reporting
- Permanent, versioned URLs
- Redirect handling for moved content

### Automation & Extraction

**Automated extraction targets:**

| Source             | Extraction                                  | Destination             |
| ------------------ | ------------------------------------------- | ----------------------- |
| TypeScript + JSDoc | Function signatures, types, params, returns | API reference           |
| `@remarks` tags    | Extended explanations                       | API page context        |
| `@example` tags    | Code examples                               | Inline examples         |
| README.md          | Project overviews                           | Project landing pages   |
| ARCHITECTURE.md    | Design documentation                        | Architecture section    |
| Unit tests         | Usage patterns                              | Auto-generated examples |
| Mermaid diagrams   | Visual documentation                        | Rendered diagrams       |
| package.json       | Dependencies, exports                       | Project metadata        |

**Test-to-example conversion:**

- Extract well-structured unit tests as usage examples
- Supplement JSDoc examples where gaps exist
- Display as code blocks (not runnable on site)
- Maintain traceability to source tests

**Controlled extraction:**

- Configuration for what gets extracted vs. excluded
- Ability to suppress internal-only APIs from public docs
- Manual override capability for generated content

---

## Monorepo Considerations

### Project Inventory

**Core Libraries (7 npm packages):**

| Package                           | Description                             | Layer         |
| --------------------------------- | --------------------------------------- | ------------- |
| `@hyperfrontend/nexus`            | Broker-channel messaging with contracts | Communication |
| `@hyperfrontend/network-protocol` | Encryption pipelines and obfuscation    | Security      |
| `@hyperfrontend/cryptography`     | AES-GCM, PBKDF2, hashing primitives     | Foundation    |
| `@hyperfrontend/state-machine`    | State management patterns               | Foundation    |
| `@hyperfrontend/logging`          | Structured logging                      | Foundation    |
| `@hyperfrontend/web-worker`       | Web Worker utilities                    | Foundation    |
| `@hyperfrontend/utils`            | Data, string, list, time, UI utilities  | Foundation    |

**Utility Sub-libraries (8 entry points under `@hyperfrontend/utils`):**

| Entry Point                             | Purpose                        |
| --------------------------------------- | ------------------------------ |
| `@hyperfrontend/utils/data`             | Data structure manipulation    |
| `@hyperfrontend/utils/function`         | Function composition utilities |
| `@hyperfrontend/utils/immutable-api`    | Immutability helpers           |
| `@hyperfrontend/utils/list`             | Array/list operations          |
| `@hyperfrontend/utils/random-generator` | Random value generation        |
| `@hyperfrontend/utils/string`           | String manipulation            |
| `@hyperfrontend/utils/time`             | Time/date utilities            |
| `@hyperfrontend/utils/ui`               | UI-related helpers             |

**Plugins (1 npm package):**

| Package                   | Description                            |
| ------------------------- | -------------------------------------- |
| `@hyperfrontend/features` | Nx plugin for feature shell generation |

**Demo Applications (6):**

| Demo       | Description                  |
| ---------- | ---------------------------- |
| Chess      | Chess game micro-frontend    |
| Clock      | Clock display feature        |
| Events     | Event handling demonstration |
| File Share | File sharing feature         |
| Heartbeat  | Connection health monitoring |
| Views      | View management demo         |

**Frontend Framework Variants (5):**

- Angular, React, Vue, Svelte, JavaScript (vanilla)

### Documentation Complexity

| Challenge                         | Mitigation Strategy                     |
| --------------------------------- | --------------------------------------- |
| 14+ independent packages          | Mirror monorepo structure in navigation |
| Layered dependencies              | Visual dependency graphs                |
| Multiple entry points per package | Clear export documentation              |
| Version coordination              | Monorepo-level versioning docs          |
| Cross-project linking             | Automated link generation               |

---

## Success Criteria

### User-Facing

| Criterion                  | Target                         |
| -------------------------- | ------------------------------ |
| Time to find answer        | ≤ 3 clicks or 1 search         |
| Page load time             | < 2 seconds                    |
| Mobile experience          | Parity with desktop            |
| Version navigation         | Seamless switching             |
| API discoverability        | 100% of public APIs documented |
| Bookmark/share reliability | All URLs permanent             |

### Developer-Facing (Maintainer)

| Criterion              | Target                                         |
| ---------------------- | ---------------------------------------------- |
| Automation rate        | 90%+ of documentation updates automated        |
| Manual intervention    | Only for guides, tutorials, conceptual content |
| Build trigger          | Automatic on release                           |
| Link integrity         | 100% verified on build                         |
| Version reconstruction | Any version rebuildable from scratch           |

### Business/Project

| Criterion              | Measurement                               |
| ---------------------- | ----------------------------------------- |
| SEO improvement        | Track search engine ranking over time     |
| Traffic growth         | Documentation site visit metrics          |
| Issue reduction        | Fewer "how to" questions in GitHub issues |
| Community contribution | PRs for documentation improvements        |

---

## Out of Scope

The following are explicitly **not** part of this documentation vision:

| Exclusion                        | Reason                                              |
| -------------------------------- | --------------------------------------------------- |
| User authentication              | Zero-barrier access is a core principle             |
| Wiki-style community editing     | Maintains consistency and quality control           |
| Video content                    | Focus on text-first documentation                   |
| Interactive sandbox/playground   | Monaco is read-only; full execution is out of scope |
| Paid/premium sections            | Project is MIT-licensed and open                    |
| Template resale/website services | Template license restrictions                       |
| Framework-specific adapter docs  | Adapters are community-owned (per MANIFESTO.md)     |

---

## Resolved Decisions

The following decisions have been made to guide implementation:

### Technical Decisions

| Decision                 | Choice                            | Rationale                                                                                                                 |
| ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Search provider          | **Algolia DocSearch**             | Free for open-source, excellent fuzzy search, maintained infrastructure, widely adopted (MDN, React, Vue docs)            |
| Version storage          | **Vercel + GitHub Releases**      | Vercel handles current version; GitHub Releases provides source-of-truth for reconstruction; no additional cost           |
| Analytics platform       | **Vercel Analytics**              | Built-in with Vercel hosting, privacy-respecting, no additional setup; supplement with Plausible if deeper metrics needed |
| Primary design template  | **`syntax` + `primer`**           | `syntax` for API documentation pages; `primer` for landing/marketing pages; both reimagined as original work              |
| Monaco integration scope | **Code highlighting + copy only** | Defer full editor to later phase; prioritize performance and core documentation value first                               |

### Process Decisions

| Decision                | Choice                               | Rationale                                                                                 |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Demo hosting            | **Vercel preview deployments**       | Each demo as separate Vercel project; linked from docs; consistent with main site hosting |
| Build performance       | **Incremental + cached builds**      | Leverage Nx caching; TypeDoc per-project; aggregate at build time; parallel generation    |
| Storage growth          | **Keep last 10 major versions**      | Archive older versions to GitHub Releases only; reconstruct on-demand if needed           |
| Search index management | **Unified index with version facet** | Single Algolia index with version metadata; filter by version in UI; simpler maintenance  |

### Design Decisions

| Decision              | Choice                                    | Rationale                                                                             |
| --------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Information density   | **High density, collapsible sections**    | Start dense; use progressive disclosure for details; test with real users             |
| Mobile navigation     | **Hamburger + breadcrumb + search**       | Collapse tree to hamburger; maintain breadcrumbs for context; prominent search bar    |
| Color palette system  | **4-tier system**                         | Core (blue), Foundation (green), Security (purple), Utilities (gray); consistent hues |
| Brand animation style | **Subtle, CSS-only, < 300ms transitions** | Professional restraint; CSS for performance; logo pulse on load only                  |

---

## Implementation Roadmap

Implementation is divided into four phases, each building on the previous. See the [Documentation Roadmap](./documentation-roadmap.md) for the master plan and links to detailed phase action plans.

| Phase                                                        | Focus                                      | Key Deliverables                                                  |
| ------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| [Phase 1: Foundation](./documentation-phase-1-foundation.md) | Site infrastructure and basic content      | Next.js site, Vercel deployment, basic navigation, Hugo migration |
| [Phase 2: Content](./documentation-phase-2-content.md)       | API documentation and content extraction   | TypeDoc integration, README extraction, link transformation       |
| [Phase 3: Discovery](./documentation-phase-3-discovery.md)   | Search, versioning, and SEO                | Algolia integration, version system, SEO optimization             |
| [Phase 4: Polish](./documentation-phase-4-polish.md)         | Interactive features, branding, engagement | Monaco views, branding assets, voting, social sharing             |

---

## Related Documentation

### Internal

- [ARCHITECTURE.md](../ARCHITECTURE.md) — Monorepo architecture overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) — Contribution guidelines
- [MANIFESTO.md](../MANIFESTO.md) — Project philosophy and scope boundaries
- [README.md](../README.md) — Project overview and quick start
- [documentation-enrichment-plan.md](../_/documentation-enrichment-plan.md) — README enrichment strategy
- [Documentation Roadmap](./documentation-roadmap.md) — Master implementation plan

### Project Documentation

- [@hyperfrontend/nexus](../libs/nexus/README.md) — Communication library
- [@hyperfrontend/cryptography](../libs/cryptography/README.md) — Cryptographic primitives
- [@hyperfrontend/network-protocol](../libs/network-protocol/README.md) — Security layer
- [@hyperfrontend/state-machine](../libs/state-machine/README.md) — State management
- [@hyperfrontend/logging](../libs/logging/README.md) — Structured logging
- [@hyperfrontend/web-worker](../libs/web-worker/README.md) — Web Worker utilities
- [@hyperfrontend/features](../plugins/features/README.md) — Nx plugin

### External References

- [Algolia DocSearch](https://docsearch.algolia.com/) — Search provider
- [Next.js Documentation](https://nextjs.org/docs) — Framework reference
- [Vercel Platform](https://vercel.com/docs) — Hosting platform
- [TypeDoc](https://typedoc.org/) — API documentation generator
- [Tailwind CSS](https://tailwindcss.com/docs) — Design system
- [Diataxis Framework](https://diataxis.fr/) — Documentation structure inspiration
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — Code editor component

---

_This document defines the target state for HyperFrontend documentation. Implementation proceeds through four phases as outlined in the [Documentation Roadmap](./documentation-roadmap.md)._

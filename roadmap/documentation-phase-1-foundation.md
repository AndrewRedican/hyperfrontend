# Phase 1: Foundation

**Documentation Roadmap — Phase 1 of 4**

Establish the technical infrastructure for the HyperFrontend documentation site.

---

## Objective

Replace the placeholder Hugo site with a production-ready [Next.js](https://nextjs.org/) application deployed to [Vercel](https://vercel.com/), providing the foundation for all subsequent documentation work.

---

## Deliverables

### 1.1 Project Setup ✅

- [x] Initialize Next.js project with TypeScript
- [x] Configure [Tailwind CSS](https://tailwindcss.com/) with custom design tokens
- [x] Set up project structure for documentation pages
- [x] Configure ESLint and Prettier for consistency
- [x] Add to Nx workspace as `docs-site` project

**Acceptance Criteria:**

- ✅ `npx nx serve docs-site` runs locally
- ✅ Hot reload works for content changes
- ✅ TypeScript strict mode enabled

### 1.2 Vercel Deployment

- [ ] Connect repository to Vercel — See [VERCEL_DEPLOYMENT.md](../apps/docs-site/VERCEL_DEPLOYMENT.md)
- [ ] Configure custom domain ([hyperfrontend.dev](https://www.hyperfrontend.dev))
- [ ] Set up preview deployments for PRs
- [ ] Configure build caching for performance
- [ ] Verify HTTPS and SSL certificates

> **Status:** Configuration files ready (`vercel.json`), awaiting manual Vercel setup.

**Acceptance Criteria:**

- Push to `main` triggers production deployment
- Custom domain resolves correctly
- Preview URLs work for pull requests

### 1.3 Navigation Structure

- [ ] Implement sidebar navigation component
- [ ] Create navigation tree matching monorepo structure
- [ ] Add breadcrumb component
- [ ] Implement mobile hamburger menu
- [ ] Add "Edit on GitHub" links

**Navigation Structure:**

```
Getting Started
├── Introduction
├── Installation
└── Quick Start
Core Libraries
├── @hyperfrontend/nexus
├── @hyperfrontend/network-protocol
├── @hyperfrontend/cryptography
├── @hyperfrontend/state-machine
├── @hyperfrontend/logging
└── @hyperfrontend/web-worker
Utility Libraries
├── @hyperfrontend/utils/data
├── @hyperfrontend/utils/function
├── @hyperfrontend/utils/immutable-api
├── @hyperfrontend/utils/list
├── @hyperfrontend/utils/random-generator
├── @hyperfrontend/utils/string
├── @hyperfrontend/utils/time
└── @hyperfrontend/utils/ui
Plugins
└── @hyperfrontend/features
Demos
Architecture
Contributing
```

**Acceptance Criteria:**

- All sections clickable and navigable
- Breadcrumbs show current location
- Mobile menu expands/collapses correctly

### 1.4 Landing Page ✅

- [x] Hero section with project tagline
- [x] Feature highlights (framework-agnostic, independent deployment, etc.)
- [x] Quick links to Getting Started, API Reference, Demos
- [ ] GitHub stars/sponsor badges
- [x] Package installation snippet

**Content Source:**

- Adapted from [README.md](../README.md) "Why Hyperfrontend?" section
- [MANIFESTO.md](../MANIFESTO.md) key points

**Acceptance Criteria:**

- ✅ Page renders within 2 seconds
- ✅ Clear call-to-action to Getting Started
- ✅ Responsive on mobile devices

### 1.5 Basic Content Pages

- [ ] Getting Started guide (from README Quick Start)
- [ ] Stub pages for each library (title + "Documentation coming soon")
- [ ] Contributing page (from CONTRIBUTING.md summary)
- [x] 404 page with navigation back to home

> **Status:** Placeholder pages exist for `/docs`, `/demos`, `/architecture`. Need to add nested routes and library stubs.

**Acceptance Criteria:**

- Getting Started is navigable and accurate
- All sidebar links lead to valid pages
- ✅ 404 page is styled consistently

### 1.6 Theme Support ✅

- [x] Implement dark/light mode toggle
- [x] Persist preference in localStorage
- [x] Respect system preference as default
- [ ] Ensure sufficient contrast in both modes

**Acceptance Criteria:**

- ✅ Toggle switches themes instantly
- ✅ Preference persists across sessions
- Both modes pass accessibility contrast checks

---

## Technical Specifications

### Project Structure (Current)

```
apps/
  docs-site/
    src/
      app/                    # Next.js App Router
        page.tsx              # Landing page
        docs/page.tsx         # Docs stub
        demos/page.tsx        # Demos stub
        architecture/page.tsx # Architecture stub
      components/
        features.tsx          # Feature highlights
        footer.tsx            # Site footer
        header.tsx            # Site header with nav
        hero.tsx              # Landing hero section
        quick-links.tsx       # Quick links grid
        theme-provider.tsx    # Dark/light mode context
        theme-toggle.tsx      # Theme toggle button
      styles/
        globals.css           # Tailwind base + custom
      lib/                    # (empty, for Phase 2)
    public/                   # Static assets
    tailwind.config.js
    next.config.js
    project.json              # Nx project config
    vercel.json               # Vercel deployment config
```

### Dependencies (Installed)

| Package                   | Version | Purpose                 |
| ------------------------- | ------- | ----------------------- |
| `next`                    | 15.5.12 | React framework         |
| `react`, `react-dom`      | 19.0.0  | UI library              |
| `tailwindcss`             | 3.4.17  | Styling                 |
| `@tailwindcss/typography` | 0.5.16  | Prose styling for docs  |
| `next-themes`             | 0.4.6   | _(unused, custom impl)_ |
| `clsx`                    | 2.1.1   | Conditional classnames  |

### Design Tokens

Based on reimagined `primer` template:

```css
/* Color palette */
--color-primary: /* blue tones */
  --color-foundation: /* green tones */ --color-security: /* purple tones */ --color-utilities: /* gray tones */ /* Typography */
    --font-sans: Inter,
  system-ui, sans-serif --font-mono: JetBrains Mono, monospace;
```

---

## Success Metrics

| Metric                 | Target               |
| ---------------------- | -------------------- |
| Lighthouse Performance | > 90                 |
| First Contentful Paint | < 1.5s               |
| Build time             | < 2 minutes          |
| Mobile responsive      | Works on 320px width |
| Accessibility          | WCAG AA compliant    |

---

## Risks & Mitigations

| Risk                           | Mitigation                                |
| ------------------------------ | ----------------------------------------- |
| Design diverges from templates | Create design system document early       |
| Build times grow               | Configure proper caching from start       |
| Navigation becomes unwieldy    | Test with full nav tree before finalizing |

---

## Related Documents

- [Documentation Roadmap](./documentation-roadmap.md) — Master plan
- [Documentation Strategy](./documentation-strategy.md) — Vision and requirements
- [Phase 2: Content](./documentation-phase-2-content.md) — Next phase

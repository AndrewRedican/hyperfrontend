# Phase 1: Foundation

**Documentation Roadmap — Phase 1 of 4**

Establish the technical infrastructure for the HyperFrontend documentation site.

---

## Objective

Replace the placeholder Hugo site with a production-ready [Next.js](https://nextjs.org/) application deployed to [Vercel](https://vercel.com/), providing the foundation for all subsequent documentation work.

---

## Deliverables

### 1.1 Project Setup

- [ ] Initialize Next.js project with TypeScript
- [ ] Configure [Tailwind CSS](https://tailwindcss.com/) with custom design tokens
- [ ] Set up project structure for documentation pages
- [ ] Configure ESLint and Prettier for consistency
- [ ] Add to Nx workspace as `docs-site` project

**Acceptance Criteria:**

- `npx nx serve docs-site` runs locally
- Hot reload works for content changes
- TypeScript strict mode enabled

### 1.2 Vercel Deployment

- [ ] Connect repository to Vercel
- [ ] Configure custom domain ([hyperfrontend.dev](https://www.hyperfrontend.dev))
- [ ] Set up preview deployments for PRs
- [ ] Configure build caching for performance
- [ ] Verify HTTPS and SSL certificates

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

### 1.4 Landing Page

- [ ] Hero section with project tagline
- [ ] Feature highlights (framework-agnostic, independent deployment, etc.)
- [ ] Quick links to Getting Started, API Reference, Demos
- [ ] GitHub stars/sponsor badges
- [ ] Package installation snippet

**Content Source:**

- Adapted from [README.md](../README.md) "Why Hyperfrontend?" section
- [MANIFESTO.md](../MANIFESTO.md) key points

**Acceptance Criteria:**

- Page renders within 2 seconds
- Clear call-to-action to Getting Started
- Responsive on mobile devices

### 1.5 Basic Content Pages

- [ ] Getting Started guide (from README Quick Start)
- [ ] Stub pages for each library (title + "Documentation coming soon")
- [ ] Contributing page (from CONTRIBUTING.md summary)
- [ ] 404 page with navigation back to home

**Acceptance Criteria:**

- Getting Started is navigable and accurate
- All sidebar links lead to valid pages
- 404 page is styled consistently

### 1.6 Theme Support

- [ ] Implement dark/light mode toggle
- [ ] Persist preference in localStorage
- [ ] Respect system preference as default
- [ ] Ensure sufficient contrast in both modes

**Acceptance Criteria:**

- Toggle switches themes instantly
- Preference persists across sessions
- Both modes pass accessibility contrast checks

---

## Technical Specifications

### Project Structure

```
apps/
  docs-site/
    src/
      app/                    # Next.js App Router
        page.tsx              # Landing page
        docs/                 # Documentation pages
          [slug]/page.tsx     # Dynamic doc pages
        api/                  # API routes (if needed)
      components/
        navigation/           # Sidebar, breadcrumbs, mobile menu
        layout/               # Header, footer, page layout
        ui/                   # Buttons, cards, etc.
      content/                # Markdown/MDX content (Phase 2)
      styles/
        globals.css           # Tailwind base + custom
      lib/
        navigation.ts         # Navigation tree definition
    public/
      logo/                   # Logo assets
    tailwind.config.ts
    next.config.mjs
    project.json              # Nx project config
```

### Dependencies

| Package                   | Purpose                |
| ------------------------- | ---------------------- |
| `next`                    | React framework        |
| `react`, `react-dom`      | UI library             |
| `tailwindcss`             | Styling                |
| `@tailwindcss/typography` | Prose styling for docs |
| `next-themes`             | Dark/light mode        |
| `clsx`                    | Conditional classnames |

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

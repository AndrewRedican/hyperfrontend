# Phase 1: Foundation

**Documentation Roadmap — Phase 1 of 4**

Establish the technical infrastructure for the HyperFrontend documentation site.

---

## Objective

Production-ready [Next.js](https://nextjs.org/) documentation site deployed to [Vercel](https://vercel.com/), with a 50/50 split landing page showcasing live micro-frontend demos.

---

## Current Status

**Completed:**

- Next.js 15 + TypeScript + Tailwind CSS setup
- Dark/light theme toggle with persistence
- 50/50 split landing page layout (value proposition + demo showcase)
- Animated progress border for demo rotation (20s cycle)
- Rotating value proposition cards (pain → feature → benefit format)
- Getting Started page with installation/usage guide
- Responsive design for mobile/desktop
- Collapsible sidebar navigation component
- Navigation tree matching monorepo structure
- Breadcrumb component
- Mobile hamburger menu
- Library stub pages (all 7 libraries + 1 plugin)
- Contributing page
- API Reference structure
- GitHub stars/sponsor badges on landing
- Accessibility improvements (skip links, ARIA attributes, focus states)
- Quick Start guide
- Core Concepts guide

**In Progress:**

- Embed actual micro-frontend demos in showcase component - DEFERRED

---

## Remaining Deliverables

### 1.1 Demo Integration

- [ ] Embed Chess demo in showcase - DEFERRED
- [ ] Embed Clock demo in showcase - DEFERRED
- [ ] Embed Events demo in showcase - DEFERRED
- [ ] Wire demo showcase to actual iframe/feature loading - DEFERRED

### 1.2 Navigation Structure

- [x] Implement collapsible sidebar navigation component
- [x] Create navigation tree matching monorepo structure
- [x] Add breadcrumb component
- [x] Implement mobile hamburger menu
- [ ] Add "Edit on GitHub" links - SKIPPED (not essential for Phase 1)

**Navigation Structure:**

```
Getting Started
├── Installation
├── Quick Start
└── Core Concepts
Libraries
├── @hyperfrontend/nexus
├── @hyperfrontend/network-protocol
├── @hyperfrontend/cryptography
└── ...
Plugins
└── @hyperfrontend/features
Demos
Architecture
```

### 1.3 Content Pages

- [x] Getting Started guide
- [x] Quick Start guide
- [x] Core Concepts guide
- [x] Library stub pages (title + "Documentation coming soon")
- [x] Contributing page
- [x] API Reference structure

### 1.4 Polish

- [x] GitHub stars/sponsor badges on landing
- [x] Accessibility audit (contrast, focus states, ARIA, skip links)
- [ ] Performance optimization (Lighthouse > 90)

---

## Technical Architecture

### Landing Page Design

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Logo | Docs | Demos | Architecture | [Theme] [GH] │
├────────────────────────────┬────────────────────────────────┤
│                            │                                │
│   Value Proposition        │    Demo Showcase               │
│   - Headline               │    ┌────────────────────────┐  │
│   - Rotating benefits      │    │                        │  │
│     (every 10s)            │    │   [Live Demo iframe]   │  │
│     Pain → Feature →       │    │                        │  │
│     Benefit format         │    │   Progress border      │  │
│                            │    │   traces (20s cycle)   │  │
│   $ npx nx add ...         │    │                        │  │
│                            │    └────────────────────────┘  │
│   [Get Started] [GitHub]   │         [Skip →]               │
│                            │                                │
├────────────────────────────┴────────────────────────────────┤
│   How it works: Host App | Feature Shell | Message Broker   │
├─────────────────────────────────────────────────────────────┤
│   Footer                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component          | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `ValueProposition` | Rotating benefit sets (6 sets, 10s each)            |
| `DemoShowcase`     | Demo container with animated progress border        |
| `ProgressBorder`   | SVG stroke-dasharray animation tracing rounded rect |

### Project Structure

```
apps/docs-site/src/
├── app/
│   ├── page.tsx              # Landing (50/50 layout)
│   ├── docs/page.tsx         # Getting Started
│   ├── demos/page.tsx        # Demo hub
│   └── architecture/page.tsx # Architecture deep-dive
├── components/
│   ├── demo-showcase.tsx     # Demo rotation container
│   ├── value-proposition.tsx # Rotating benefits
│   ├── header.tsx            # Site navigation
│   └── footer.tsx            # Site footer
└── styles/globals.css        # Tailwind + custom utilities
```

---

## Success Metrics

| Metric                 | Target           |
| ---------------------- | ---------------- |
| Lighthouse Performance | > 90             |
| First Contentful Paint | < 1.5s           |
| Mobile usability       | 100% responsive  |
| Demo load time         | < 2s per feature |

---

## Related Documents

- [Documentation Roadmap](./documentation-roadmap.md) — Master plan
- [Phase 2: Content](./documentation-phase-2-content.md) — API documentation

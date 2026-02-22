# Documentation Roadmap

Documentation site implementation plan for the HyperFrontend framework.

**Site:** [hyperfrontend.dev](https://www.hyperfrontend.dev)

---

## Current Status

**Completed:**

- ✅ Next.js 15 site deployed to Vercel
- ✅ TypeDoc API generation for all 16 libraries
- ✅ README.md and ARCHITECTURE.md extraction
- ✅ Mermaid diagram rendering (client-side)
- ✅ Link transformation (GitHub → docs site)
- ✅ Search/filter within API reference
- ✅ Module-grouped view for multi-entry-point libraries
- ✅ Copy-to-clipboard for code/signatures
- ✅ Dark/light theme toggle
- ✅ Responsive navigation

**Known Issues:**

- `/architecture` page shows placeholder instead of generated content
- Library architecture pages (nexus, network-protocol, state-machine) not accessible as standalone routes

---

## Pending Work

### Phase 2.5: Polish Items

| Task                                                                       | Priority |
| -------------------------------------------------------------------------- | -------- |
| Render `/architecture` page from generated `architecture.md`               | High     |
| Create library architecture routes (`/docs/libraries/{slug}/architecture`) | Medium   |
| Complex generic type rendering improvements                                | Low      |

### Phase 3: Discovery

Full details: [documentation-phase-3-discovery.md](./documentation-phase-3-discovery.md)

| Deliverable       | Description                         |
| ----------------- | ----------------------------------- |
| Algolia DocSearch | Fuzzy search integration            |
| Version Selector  | UI component for version switching  |
| Versioned URLs    | `/docs/v{version}/{path}` structure |
| Version Pipeline  | Build docs from Git tags            |
| SEO Meta Tags     | Title, description, Open Graph      |
| Sitemap           | Auto-generated sitemap.xml          |
| Structured Data   | JSON-LD for documentation pages     |

### Phase 4: Polish

Full details: [documentation-phase-4-polish.md](./documentation-phase-4-polish.md)

| Deliverable       | Description                               |
| ----------------- | ----------------------------------------- |
| Monaco Code Views | Read-only Monaco editor for code blocks   |
| Branding Assets   | SVG logo, favicons, social cards          |
| Logo Animation    | Subtle CSS animations                     |
| Issue Reporting   | "Report issue" → GitHub integration       |
| Usefulness Voting | Thumbs up/down per page                   |
| Social Sharing    | Share buttons (Twitter, LinkedIn, Reddit) |
| RSS Feed          | Release announcements feed                |

### Deferred

| Item                   | Reason                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Demo Integration       | Demos not yet implemented (see [demos-implementation-plan.md](./demos-implementation-plan.md)) |
| "Edit on GitHub" links | Not essential                                                                                  |

---

## Technology Stack

| Area             | Choice                                              |
| ---------------- | --------------------------------------------------- |
| Framework        | [Next.js 15](https://nextjs.org/)                   |
| Hosting          | [Vercel](https://vercel.com/)                       |
| Styling          | [Tailwind CSS 3.4](https://tailwindcss.com/)        |
| API Docs         | [TypeDoc 0.28](https://typedoc.org/)                |
| Diagrams         | [Mermaid](https://mermaid.js.org/)                  |
| Search (planned) | [Algolia DocSearch](https://docsearch.algolia.com/) |

---

## Related Documentation

- [apps/docs-site/README.md](../apps/docs-site/README.md) — Technical documentation
- [ARCHITECTURE.md](../ARCHITECTURE.md) — Monorepo architecture
- [demos-implementation-plan.md](./demos-implementation-plan.md) — Demo applications plan

---

_This roadmap is a living document. Phase details may evolve as implementation progresses and learnings emerge._

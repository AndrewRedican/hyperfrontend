# Documentation Site Action Plan

Improve docs-site SEO, branding, and engagement using Next.js built-in features. No external npm packages required.

---

## Phase 1: SEO (Foundation)

**Detailed plan:** [seo-implementation-plan.md](./seo-implementation-plan.md)

- Root layout metadata (metadataBase, twitter, alternates)
- sitemap.ts and robots.ts
- Per-page metadata for 20+ pages
- Library metadata utility using manifest

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Phase 2: Branding (Isolated)

Favicon and social card assets.

### 2.1 Favicon Setup

Convert from `assets/logo/hyperfrontend.png`.

**Files:**

- `apps/docs-site/src/app/favicon.ico` — Create (32x32)
- `apps/docs-site/src/app/icon.png` — Create (192x192)
- `apps/docs-site/src/app/apple-icon.png` — Create (180x180)

### 2.2 Open Graph Images

**Files:**

- `apps/docs-site/src/app/opengraph-image.png` — Create (1200x630)
- `apps/docs-site/src/app/twitter-image.png` — Create (1200x600)

### 2.3 SVG Logo

**Files:**

- `assets/logo/hyperfrontend.svg` — Create

### Verification

```bash
npx nx build docs-site
# Test with https://opengraph.xyz
```

---

## Phase 3: Structured Data (Isolated)

JSON-LD for rich search results.

### 3.1 SoftwareApplication Schema

Add JSON-LD script to root layout.

**Files:**

- `apps/docs-site/src/app/layout.tsx` — Edit

### 3.2 BreadcrumbList Schema

Add breadcrumb JSON-LD to documentation pages.

**Files:**

- `apps/docs-site/src/components/breadcrumbs.tsx` — Edit or create

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
# Test with https://search.google.com/test/rich-results
```

---

## Phase 4: Engagement (Integration)

User interaction features.

### 4.1 Issue Reporting Link

Add "Report an issue" link to footer with pre-filled GitHub issue URL.

**Files:**

- `apps/docs-site/src/components/footer.tsx` — Edit

### 4.2 Social Sharing Links

Add Twitter/LinkedIn share links (URL-based, no package).

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

## Phase 5: Accessibility (Integration)

WCAG AA compliance.

### 5.1 Accessibility Audit

- Run Lighthouse accessibility audit
- Fix color contrast issues
- Verify alt text on images
- Test keyboard navigation
- Verify focus indicators

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
| Demo Showcase     | Demos not yet implemented       |
| Version Selector  | Lower priority                  |
| Versioned URLs    | Lower priority                  |

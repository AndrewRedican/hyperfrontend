# SEO Implementation Plan

Add sitemap, robots.txt, Twitter cards, canonical URLs, and per-page metadata to docs-site using Next.js 15 built-in features. No external packages required.

---

## Phase 1: Foundation

Core metadata infrastructure in root layout.

### 1.1 Update Root Layout Metadata

Add `metadataBase`, `twitter`, and `alternates` to existing metadata export.

**File:** `apps/docs-site/src/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://hyperfrontend.dev'),
  title: {
    default: 'HyperFrontend - Micro-Frontend Architecture',
    template: '%s | HyperFrontend',
  },
  description:
    'A hybrid micro-frontend pattern to embed live web applications with communication protocols, lifecycle, and contract standards.',
  keywords: ['micro-frontend', 'microfrontend', 'web components', 'iframe', 'react', 'angular', 'vue', 'svelte'],
  authors: [{ name: 'Andrew Redican' }],
  openGraph: {
    title: 'HyperFrontend',
    description: 'Compose your existing apps together securely — like Lego bricks.',
    url: 'https://hyperfrontend.dev',
    siteName: 'HyperFrontend',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HyperFrontend',
    description: 'Compose your existing apps together securely — like Lego bricks.',
    creator: '@ARedican',
  },
  alternates: {
    canonical: './',
  },
}
```

**Changes:**

- Add `metadataBase` for absolute URL resolution
- Add `title.template` for child page titles
- Add `twitter` object with card type and creator
- Add `alternates.canonical` for canonical URLs
- Add `locale` to openGraph

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Phase 2: Sitemap & Robots

Static file generation using Next.js conventions.

### 2.1 Create Sitemap

Generate sitemap.xml at build time. Uses navigation structure to enumerate all pages.

**File:** `apps/docs-site/src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from 'next'
import { docsNavigation, mainNavLinks } from '@/lib/navigation'
import type { NavItem } from '@/lib/navigation'

const BASE_URL = 'https://hyperfrontend.dev'

/**
 * Recursively extract all href values from navigation items.
 */
function extractUrls(items: NavItem[]): string[] {
  const urls: string[] = []

  for (const item of items) {
    if (item.href) {
      urls.push(item.href)
    }
    if (item.children) {
      urls.push(...extractUrls(item.children))
    }
  }

  return urls
}

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['/', '/architecture', '/demos']

  const navUrls = extractUrls(docsNavigation)
  const mainUrls = mainNavLinks.map((link) => link.href)

  const allUrls = [...new Set([...staticPages, ...navUrls, ...mainUrls])]

  return allUrls.map((url) => ({
    url: `${BASE_URL}${url}`,
    lastModified: new Date(),
    changeFrequency: url === '/' ? 'weekly' : 'monthly',
    priority: url === '/' ? 1.0 : url.startsWith('/docs/libraries') ? 0.8 : 0.6,
  }))
}
```

### 2.2 Create Robots.txt

Allow all crawlers with sitemap reference.

**File:** `apps/docs-site/src/app/robots.ts`

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://hyperfrontend.dev/sitemap.xml',
  }
}
```

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
# After build, verify files exist:
ls apps/docs-site/out/sitemap.xml
ls apps/docs-site/out/robots.txt
```

---

## Phase 3: Per-Page Metadata

Add `generateMetadata` exports to key pages for unique titles and descriptions.

### 3.1 Architecture Page

**File:** `apps/docs-site/src/app/architecture/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Architecture',
  description: 'Hyperfrontend layered architecture for runtime micro-frontend integration with secure, contract-validated messaging.',
}
```

### 3.2 Docs Landing Page

**File:** `apps/docs-site/src/app/docs/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Getting started with HyperFrontend micro-frontend architecture. Installation, quick start, and core concepts.',
}
```

### 3.3 Core Concepts Page

**File:** `apps/docs-site/src/app/docs/core-concepts/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Core Concepts',
  description: 'Understand HyperFrontend fundamentals: communication patterns, iframe integration, and feature composition.',
}
```

### 3.4 Libraries Index Page

**File:** `apps/docs-site/src/app/docs/libraries/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Libraries',
  description: 'Browse the HyperFrontend library ecosystem: nexus, network-protocol, state-machine, and utility packages.',
}
```

### 3.5 Quick Start Page

**File:** `apps/docs-site/src/app/docs/quick-start/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get up and running with HyperFrontend in minutes. Install packages and create your first feature.',
}
```

### 3.6 Demos Page

**File:** `apps/docs-site/src/app/demos/page.tsx`

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Demos',
  description: 'Interactive demonstrations of HyperFrontend micro-frontend architecture across React, Vue, and Svelte.',
}
```

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
```

---

## Phase 4: Library Page Metadata

Add dynamic metadata to library pages using manifest data.

### 4.1 Create Metadata Utility

Helper function to generate metadata from manifest.

**File:** `apps/docs-site/src/lib/metadata.ts`

```typescript
import type { Metadata } from 'next'
import { getManifest } from './docs-loader'

/**
 * Generate metadata for a library documentation page.
 *
 * @param slug - The library URL slug
 * @returns Metadata object with title and description
 */
export function getLibraryMetadata(slug: string): Metadata {
  const manifest = getManifest()
  const library = manifest?.libraries.find((lib) => lib.slug === slug)

  if (!library) {
    return {
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
    }
  }

  return {
    title: library.name,
    description: library.description,
    keywords: library.keywords,
  }
}
```

### 4.2 Update Nexus Page

Example of adding metadata to a library page.

**File:** `apps/docs-site/src/app/docs/libraries/nexus/page.tsx`

Add export:

```typescript
import type { Metadata } from 'next'
import { getLibraryMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getLibraryMetadata('nexus')
}
```

### 4.3 Apply Pattern to Remaining Library Pages

Apply the same pattern to these files:

- `apps/docs-site/src/app/docs/libraries/cryptography/page.tsx`
- `apps/docs-site/src/app/docs/libraries/logging/page.tsx`
- `apps/docs-site/src/app/docs/libraries/network-protocol/page.tsx`
- `apps/docs-site/src/app/docs/libraries/project-scope/page.tsx`
- `apps/docs-site/src/app/docs/libraries/state-machine/page.tsx`
- `apps/docs-site/src/app/docs/libraries/versioning/page.tsx`
- `apps/docs-site/src/app/docs/libraries/web-worker/page.tsx`

For utils libraries:

- `apps/docs-site/src/app/docs/libraries/utils/data/page.tsx` → slug: `data-utils`
- `apps/docs-site/src/app/docs/libraries/utils/function/page.tsx` → slug: `function-utils`
- `apps/docs-site/src/app/docs/libraries/utils/immutable-api/page.tsx` → slug: `immutable-api-utils`
- `apps/docs-site/src/app/docs/libraries/utils/json/page.tsx` → slug: `json-utils`
- `apps/docs-site/src/app/docs/libraries/utils/list/page.tsx` → slug: `list-utils`
- `apps/docs-site/src/app/docs/libraries/utils/random-generator/page.tsx` → slug: `random-generator-utils`
- `apps/docs-site/src/app/docs/libraries/utils/string/page.tsx` → slug: `string-utils`
- `apps/docs-site/src/app/docs/libraries/utils/time/page.tsx` → slug: `time-utils`
- `apps/docs-site/src/app/docs/libraries/utils/ui/page.tsx` → slug: `ui-utils`

### Verification

```bash
npx nx build docs-site
npx nx lint docs-site --fix
npx nx typecheck docs-site
npx nx format:write --projects=docs-site
```

---

## Files Summary

| Action | File                                                 |
| ------ | ---------------------------------------------------- |
| Edit   | `apps/docs-site/src/app/layout.tsx`                  |
| Create | `apps/docs-site/src/app/sitemap.ts`                  |
| Create | `apps/docs-site/src/app/robots.ts`                   |
| Create | `apps/docs-site/src/lib/metadata.ts`                 |
| Edit   | `apps/docs-site/src/app/architecture/page.tsx`       |
| Edit   | `apps/docs-site/src/app/docs/page.tsx`               |
| Edit   | `apps/docs-site/src/app/docs/core-concepts/page.tsx` |
| Edit   | `apps/docs-site/src/app/docs/libraries/page.tsx`     |
| Edit   | `apps/docs-site/src/app/docs/quick-start/page.tsx`   |
| Edit   | `apps/docs-site/src/app/demos/page.tsx`              |
| Edit   | 16 library page.tsx files                            |

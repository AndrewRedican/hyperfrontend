# docs-site-page-metadata

Require docs-site app router pages to export metadata following the centralized metadata conventions.

## Rule Details

Every `page.tsx` under the docs-site app dir must export `metadata` or `generateMetadata` so each route ships a title, description, canonical URL, and social cards. The rule understands the docs-site route layout and derives the conventional structure for the page from its file location:

- `docs/libraries/<slug>` pages call `getLibraryMetadata('<slug>')`; pages under `docs/libraries/utils/<segment>` use the `<segment>-utils` manifest slug.
- `docs/libraries/<slug>/architecture` pages call `getArchitectureMetadata('<slug>')`.
- Deeper library pages call `getSubmoduleMetadata({ librarySlug, packageName, submodulePath, path })` with every argument derived from the route.
- Dynamic segment pages (`[slug]`) and hand-written pages export a literal structure with `title` and `description`.

The autofix inserts that structure, together with the `Metadata` type import and the helper import placed per the pages' import ordering. Values the rule cannot derive are inserted as `undefined` placeholders, which the rule keeps reporting until a human completes them. Literal helper arguments that do not match the route are reported with an autofix to the derived value, catching copy-paste drift from sibling pages.

Pages marked `'use client'` are reported without a fix: Next.js forbids metadata exports in client components, so the page must stay a server component that renders the client pieces.

## Examples

### ❌ Incorrect

```tsx
export default function Page() {
  return <LibraryDocPage title="Logging" packageName="@hyperfrontend/logging" slug="logging" category="supporting" />
}
```

```tsx
import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/parse',
    path: '/docs/libraries/versioning/commits/parse/',
  })
}

export default function Page() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="commits/format" />
}
```

The second example sits at `docs/libraries/versioning/commits/format/page.tsx` but carries metadata copied from the `commits/parse` sibling; the rule reports `submodulePath` and `path` with autofixes to the derived values.

### ✅ Correct

```tsx
import type { Metadata } from 'next'
import { getSubmoduleMetadata } from '@/lib/metadata'

export function generateMetadata(): Metadata {
  return getSubmoduleMetadata({
    librarySlug: 'versioning',
    packageName: '@hyperfrontend/versioning',
    submodulePath: 'commits/format',
    path: '/docs/libraries/versioning/commits/format/',
  })
}

export default function Page() {
  return <SubmoduleDocPage librarySlug="versioning" packageName="@hyperfrontend/versioning" submodulePath="commits/format" />
}
```

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get a micro-frontend feature running in under 5 minutes.',
}

export default function Page() {
  return <QuickStartContent />
}
```

## When Not To Use It

Only pages that intentionally inherit the site-default metadata from a layout should disable the rule. The docs-site landing page (`src/app/page.tsx`) is the one such route: the root layout's metadata is written as the homepage metadata, so the docs-site ESLint config turns the rule off for that file.

## Options

This rule has no options.

## Fixable

Yes. Missing metadata exports are fixed by inserting the route's conventional structure (with `undefined` placeholders for values needing human input), and mismatched literal helper arguments are fixed to the route-derived values. Placeholder and client-page reports are not auto-fixable.

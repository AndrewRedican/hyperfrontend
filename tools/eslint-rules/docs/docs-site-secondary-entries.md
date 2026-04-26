# docs-site-secondary-entries

Ensure every secondary entrypoint declared in a library `package.json` has a corresponding `page.tsx` route and navigation entry in the docs-site.

## Rule Details

[`docs-site-routes`](./docs-site-routes.md) only validates the top-level library route — the page that maps to the library's primary entrypoint. It does not look at secondary entrypoints (the keys of `package.json` `exports` other than `.`), so sub-modules like `@hyperfrontend/versioning/commits/parse` can ship to npm without an associated page or sidebar link.

This rule closes that gap. For each library entry in the `LIBRARIES` array of `apps/docs-site/src/lib/content.ts`, it:

1. Reads `<libraryRoot>/package.json` (where `libraryRoot` is derived from the entry's `readmePath`).
2. Enumerates secondary entrypoint subpaths from `exports` — every key that starts with `./` other than `.` and `./package.json`. Glob keys (`./*`, `./foo/*`) are skipped because they do not map to a single page.
3. For each subpath, asserts:
   - A `page.tsx` exists at the canonical docs-site route.
   - A matching `href` token appears in `apps/docs-site/src/lib/navigation.ts`.

### Route Mapping

| Category   | Route Location                                                    |
| ---------- | ----------------------------------------------------------------- |
| core       | `apps/docs-site/src/app/docs/libraries/{slug}/{subpath}/page.tsx` |
| supporting | `apps/docs-site/src/app/docs/libraries/{slug}/{subpath}/page.tsx` |
| utils      | `apps/docs-site/src/app/docs/libraries/{slug}/{subpath}/page.tsx` |
| plugin     | `apps/docs-site/src/app/docs/plugins/{slug}/{subpath}/page.tsx`   |

### Navigation Mapping

| Category   | Expected href                      |
| ---------- | ---------------------------------- |
| core       | `/docs/libraries/{slug}/{subpath}` |
| supporting | `/docs/libraries/{slug}/{subpath}` |
| utils      | `/docs/libraries/{slug}/{subpath}` |
| plugin     | `/docs/plugins/{slug}/{subpath}`   |

### Why?

- **API surface visibility**: every npm-published entrypoint should have a docs page; otherwise consumers cannot discover the API.
- **Navigation completeness**: pages that exist but are not linked from the sidebar are unreachable in practice. This rule catches both halves of the gap.
- **Drift detection**: when a developer adds `./foo/bar` to `package.json` `exports`, the rule flags the missing route immediately rather than letting it ship undocumented.

## Examples

### ❌ Incorrect

A library declares a secondary entrypoint but the docs-site has no page for it:

```json
// libs/versioning/package.json
{
  "exports": {
    ".": "./src/index.js",
    "./commits/parse": "./src/commits/parse/index.js"
  }
}
```

```typescript
// apps/docs-site/src/lib/content.ts
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Versioning',
    slug: 'versioning',
    readmePath: 'libs/versioning/README.md',
    category: 'supporting',
    // ...
  },
]
```

Errors:

```text
Library 'Versioning' secondary entrypoint './commits/parse' is missing required page.tsx at apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx
Library 'Versioning' secondary entrypoint './commits/parse' is missing navigation entry "href: '/docs/libraries/versioning/commits/parse'" in navigation.ts
```

### ✅ Correct

The page exists and the navigation tree links to it:

```text
apps/docs-site/src/app/docs/libraries/versioning/commits/parse/page.tsx  ✓
```

```typescript
// apps/docs-site/src/lib/navigation.ts — under supportingLibraries
{
  slug: 'versioning',
  href: '/docs/libraries/versioning',
  children: [
    {
      slug: 'commits',
      href: '/docs/libraries/versioning/commits',
      children: [
        { slug: 'parse', href: '/docs/libraries/versioning/commits/parse' },
      ],
    },
  ],
}
```

## Configuration

```javascript
// apps/docs-site/eslint.config.cjs
{
  files: ['src/lib/content.ts'],
  plugins: {
    workspace: eslintRules,
  },
  rules: {
    'workspace/docs-site-secondary-entries': 'error',
  },
}
```

## Related Rules

- [docs-site-routes](./docs-site-routes.md) — top-level routes, navigation, and `generate-docs.ts` entries.
- [docs-site-library-docs](./docs-site-library-docs.md) — every markdown file in a library has a corresponding docs page.
- [docs-site-libraries](./docs-site-libraries.md) — every publishable library is registered in the LIBRARIES array.

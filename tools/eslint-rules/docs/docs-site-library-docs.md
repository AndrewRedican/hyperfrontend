# docs-site-library-docs

Ensure all markdown files in publishable libraries have corresponding docs-site pages.

## Rule Details

This rule validates that each markdown file in a publishable library has a corresponding Next.js page route file (page.tsx) in the docs-site application. It scans the library directory for `.md` files and checks for matching pages.

### File Mapping

| Library File                            | Expected Docs Page                                                   |
| --------------------------------------- | -------------------------------------------------------------------- |
| `libs/{slug}/README.md`                 | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx`              |
| `libs/{slug}/ARCHITECTURE.md`           | `apps/docs-site/src/app/docs/libraries/{slug}/architecture/page.tsx` |
| `libs/{slug}/src/core/README.md`        | `apps/docs-site/src/app/docs/libraries/{slug}/core/page.tsx`         |
| `libs/{slug}/src/lib/channel/README.md` | `apps/docs-site/src/app/docs/libraries/{slug}/channel/page.tsx`      |
| `plugins/{slug}/README.md`              | `apps/docs-site/src/app/docs/plugins/{slug}/page.tsx`                |

### Excluded Files

The following files are excluded from documentation requirements:

- `CHANGELOG.md` - Auto-generated release notes
- `LICENSE.md` - License information
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Community guidelines

### Why?

- **Documentation completeness**: All library documentation should be accessible via the docs site
- **Content discoverability**: Prevents orphaned markdown files that users can't find
- **Build validation**: Ensures docs structure matches library structure
- **CI integration**: Catches missing documentation pages before deployment

## Examples

### ❌ Incorrect

Library has ARCHITECTURE.md but no corresponding docs page:

```typescript
// content.ts
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  },
]

// libs/nexus/ARCHITECTURE.md exists
// apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx is MISSING

// Error: Library 'Nexus' markdown file 'ARCHITECTURE.md' is missing corresponding docs page at apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx
```

### ✅ Correct

All markdown files have corresponding docs pages:

```typescript
// content.ts
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  },
]
```

With corresponding pages:

```
libs/nexus/
├── README.md           → apps/docs-site/src/app/docs/libraries/nexus/page.tsx
├── ARCHITECTURE.md     → apps/docs-site/src/app/docs/libraries/nexus/architecture/page.tsx
├── CHANGELOG.md        (excluded)
└── src/
    └── core/
        └── README.md   → apps/docs-site/src/app/docs/libraries/nexus/core/page.tsx
```

### Nested Utils Example

For utils libraries with nested slugs:

```typescript
// content.ts
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Data Utils',
    packageName: '@hyperfrontend/data-utils',
    slug: 'utils/data',
    readmePath: 'libs/utils/data/README.md',
    entryPoints: ['libs/utils/data/src/index.ts'],
    category: 'utils',
  },
]
```

Expected page structure:

```
libs/utils/data/
├── README.md           → apps/docs-site/src/app/docs/libraries/utils/data/page.tsx
└── DESIGN.md           → apps/docs-site/src/app/docs/libraries/utils/data/design/page.tsx
```

### Plugin Example

For plugins, routes use the `/docs/plugins/` path:

```typescript
// content.ts
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Features Plugin',
    packageName: '@hyperfrontend/features',
    slug: 'features',
    readmePath: 'plugins/features/README.md',
    entryPoints: ['plugins/features/src/index.ts'],
    category: 'plugin',
  },
]
```

Expected page:

```
plugins/features/
└── README.md           → apps/docs-site/src/app/docs/plugins/features/page.tsx
```

## Route Slug Computation

### Directory-based README files

For `README.md` files in subdirectories, the route slug is computed by:

1. Stripping the `src/` prefix if present
2. Stripping the `lib/` prefix if present after `src/`
3. Converting to lowercase

Examples:

| Directory Path        | Route Slug    |
| --------------------- | ------------- |
| `src/core`            | `core`        |
| `src/lib/channel`     | `channel`     |
| `src/lib/nested/deep` | `nested/deep` |
| `examples`            | `examples`    |

### Non-README markdown files

For other `.md` files (like `ARCHITECTURE.md`), the route slug is the lowercase filename without the extension:

| File Path         | Route Slug     |
| ----------------- | -------------- |
| `ARCHITECTURE.md` | `architecture` |
| `DESIGN.md`       | `design`       |
| `INTERNALS.md`    | `internals`    |

## When Not To Use

This rule may produce false positives for:

- Libraries with internal documentation not intended for the public docs site
- Draft documentation that hasn't been published yet
- Legacy markdown files that are being phased out

Consider disabling on a per-library basis using ESLint directive comments or adjusting the LIBRARIES array.

## Related Rules

- [docs-site-libraries](./docs-site-libraries.md) - Ensures all publishable libraries are listed
- [docs-site-routes](./docs-site-routes.md) - Ensures all listed libraries have main page routes

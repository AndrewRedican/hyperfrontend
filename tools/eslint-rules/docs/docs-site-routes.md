# docs-site-routes

Ensure all libraries in the LIBRARIES array have a corresponding page.tsx route, navigation entry, and generate-docs entry.

## Rule Details

This rule validates that each library entry defined in the `LIBRARIES` array in `apps/docs-site/src/lib/content.ts` has:

1. A corresponding Next.js page route file (`page.tsx`) in the appropriate location.
2. A navigation href entry in `apps/docs-site/src/lib/navigation.ts`.
3. A `packageName` entry in the `LIBRARIES` array in `apps/docs-site/scripts/generate-docs.ts`.
4. A slug entry in `LIBRARY_SLUGS` in `generate-docs.ts` (required for `core` and `supporting` categories only).

### Route Mapping

Routes are determined based on the library's `slug` and `category`:

| Category   | Route Location                                          |
| ---------- | ------------------------------------------------------- |
| core       | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| supporting | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| utils      | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| plugin     | `apps/docs-site/src/app/docs/plugins/{slug}/page.tsx`   |

### Navigation Mapping

Navigation hrefs are required in `navigation.ts`:

| Category   | Expected href            |
| ---------- | ------------------------ |
| core       | `/docs/libraries/{slug}` |
| supporting | `/docs/libraries/{slug}` |
| utils      | `/docs/libraries/{slug}` |
| plugin     | `/docs/plugins/{slug}`   |

### generate-docs Requirements

Every library must appear in `generate-docs.ts`:

- **LIBRARIES array**: must contain an object with `packageName: '{packageName}'`.
- **LIBRARY_SLUGS record**: `core` and `supporting` libraries must have a `{slug}: '{slug}'` entry.

### Why?

- **Route completeness**: All documented libraries should have accessible pages.
- **Navigation consistency**: Every library must be reachable from the sidebar; missing entries produce broken navigation links.
- **Doc generation consistency**: All libraries must be present in `generate-docs.ts` for API docs and README extraction to work.
- **Link transformation**: `core` and `supporting` libraries need a `LIBRARY_SLUGS` entry so cross-library ARCHITECTURE.md links resolve correctly.
- **CI integration**: Catches missing entries before deploy.

## Examples

### ❌ Incorrect

Missing page.tsx for a declared library:

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
// Error: Library 'Nexus' (slug: 'nexus') is missing required page.tsx at apps/docs-site/src/app/docs/libraries/nexus/page.tsx
```

Missing navigation entry:

```typescript
// navigation.ts has no entry with href: '/docs/libraries/nexus'
// Error: Library 'Nexus' (slug: 'nexus') is missing navigation entry "href: '/docs/libraries/nexus'" in navigation.ts
```

Missing generate-docs LIBRARIES entry:

```typescript
// generate-docs.ts LIBRARIES has no object with packageName: '@hyperfrontend/nexus'
// Error: Library 'Nexus' (slug: 'nexus') is missing from LIBRARIES array in generate-docs.ts
```

Missing LIBRARY_SLUGS entry (core/supporting only):

```typescript
// generate-docs.ts LIBRARY_SLUGS has no 'nexus: 'nexus'' entry
// Error: Library 'Nexus' (slug: 'nexus') is missing from LIBRARY_SLUGS in generate-docs.ts
```

### ✅ Correct

All four requirements satisfied:

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

With:

```
apps/docs-site/src/app/docs/libraries/nexus/page.tsx  ✓
```

```typescript
// navigation.ts — in coreLibraries
{ slug: 'nexus', packageName: '@hyperfrontend/nexus', href: '/docs/libraries/nexus' }
```

```typescript
// generate-docs.ts — in LIBRARIES
{ name: 'Nexus', packageName: '@hyperfrontend/nexus', slug: 'nexus', srcPath: 'libs/nexus', category: 'core' }

// generate-docs.ts — in LIBRARY_SLUGS
nexus: 'nexus',
```

### Plugin Example

For plugins, the route uses `/docs/plugins/` and LIBRARY_SLUGS is not required:

```typescript
// content.ts
{
  name: 'Features Plugin',
  packageName: '@hyperfrontend/features',
  slug: 'features',
  readmePath: 'plugins/features/README.md',
  entryPoints: ['plugins/features/src/index.ts'],
  category: 'plugin',
}
```

Requires:

- `apps/docs-site/src/app/docs/plugins/features/page.tsx`
- `href: '/docs/plugins/features'` in navigation.ts
- `packageName: '@hyperfrontend/features'` in generate-docs.ts LIBRARIES
- No LIBRARY_SLUGS entry required

### Nested Slug Example

For utils libraries with nested slugs:

```typescript
// content.ts
{
  name: 'Data Utils',
  packageName: '@hyperfrontend/data-utils',
  slug: 'utils/data',
  readmePath: 'libs/utils/data/README.md',
  entryPoints: ['libs/utils/data/src/index.ts'],
  category: 'utils',
}
```

Requires:

- `apps/docs-site/src/app/docs/libraries/utils/data/page.tsx`
- `href: '/docs/libraries/utils/data'` in navigation.ts
- `packageName: '@hyperfrontend/data-utils'` in generate-docs.ts LIBRARIES
- No LIBRARY_SLUGS entry required

## Configuration

```javascript
// apps/docs-site/eslint.config.cjs
{
  files: ['src/lib/content.ts'],
  plugins: {
    workspace: eslintRules,
  },
  rules: {
    'workspace/docs-site-routes': 'error',
  },
}
```

## Related Rules

- [docs-site-libraries](./docs-site-libraries.md) - Ensures all publishable libraries are in the LIBRARIES array

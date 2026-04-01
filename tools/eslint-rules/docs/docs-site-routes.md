# docs-site-routes

Ensure all libraries in the LIBRARIES array have a corresponding page.tsx route.

## Rule Details

This rule validates that each library entry defined in the `LIBRARIES` array in `apps/docs-site/src/lib/content.ts` has a corresponding Next.js page route file (page.tsx) in the appropriate location.

### Route Mapping

Routes are determined based on the library's `slug` and `category`:

| Category   | Route Location                                          |
| ---------- | ------------------------------------------------------- |
| core       | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| supporting | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| utils      | `apps/docs-site/src/app/docs/libraries/{slug}/page.tsx` |
| plugin     | `apps/docs-site/src/app/docs/plugins/{slug}/page.tsx`   |

### Why?

- **Route completeness**: All documented libraries should have accessible pages
- **Build validation**: Missing pages cause Next.js build failures
- **User experience**: Prevents broken links in documentation navigation
- **CI integration**: Catches missing routes before deploy

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

### ✅ Correct

Library has corresponding page.tsx:

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

With the corresponding page file at:

```
apps/docs-site/src/app/docs/libraries/nexus/page.tsx
```

### Plugin Example

For plugins, the route uses the `/docs/plugins/` path:

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

Requires page at:

```
apps/docs-site/src/app/docs/plugins/features/page.tsx
```

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

Requires page at:

```
apps/docs-site/src/app/docs/libraries/utils/data/page.tsx
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
    'workspace/docs-site-routes': 'error',
  },
}
```

## Related Rules

- [docs-site-libraries](./docs-site-libraries.md) - Ensures all publishable libraries are in the LIBRARIES array

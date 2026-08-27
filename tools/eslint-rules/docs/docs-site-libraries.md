# docs-site-libraries

Ensure all publishable libraries are listed in the docs-site LIBRARIES array and placed in the ecosystem hierarchy.

## Rule Details

This rule validates that all publishable library projects from `libs/` and `plugins/` folders are included in the docs-site's LIBRARIES arrays. This ensures documentation stays in sync with publishable packages.

Being listed is necessary but not sufficient: `/docs/libraries` draws the ecosystem from the levels declared in `apps/docs-site/src/lib/ecosystem.ts`, so a library that no level places would be documented and still invisible on the index. When linting `content.ts`, the rule also requires every publishable library to appear in that file.

### What is a Publishable Library?

A project is considered a publishable library if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined
4. Has a `package.json` with a valid `name` field

### What Files are Checked?

The rule validates LIBRARIES arrays in the following files:

1. **`apps/docs-site/src/lib/content.ts`** - The exported `LIBRARIES` array used for documentation loading
2. **`apps/docs-site/scripts/generate-docs.ts`** - The module-level `LIBRARIES` array used for doc generation

While checking `content.ts`, the rule additionally reads `apps/docs-site/src/lib/ecosystem.ts` and requires each publishable package name to appear there. The check is skipped when that file is absent, so a workspace without a docs site is unaffected.

### Why?

- **Documentation completeness**: All published packages should be documented
- **Discoverability**: Users can find documentation for all available packages
- **Index completeness**: A package the ecosystem hierarchy does not place never reaches `/docs/libraries`
- **Consistency**: Prevents publishing packages without updating docs
- **Maintainability**: CI can catch missing packages before merge

## Examples

### ❌ Incorrect

Missing a publishable library:

```typescript
// content.ts - missing @hyperfrontend/nexus
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Logging',
    packageName: '@hyperfrontend/logging',
    slug: 'logging',
    readmePath: 'libs/logging/README.md',
    entryPoints: ['libs/logging/src/index.ts'],
    category: 'supporting',
  },
]
// Error: Publishable library '@hyperfrontend/nexus' (libs/nexus) is not listed in the LIBRARIES array
```

Listed, but placed on no level of the ecosystem hierarchy:

```typescript
// ecosystem.ts - @hyperfrontend/logging appears on no level
export const ECOSYSTEM_TIERS = [{ id: 'sdk', label: 'Start here', packages: ['@hyperfrontend/features'] }]
// Error: Publishable library '@hyperfrontend/logging' (libs/logging) is not placed on any level of ECOSYSTEM_TIERS
```

### ✅ Correct

All publishable libraries listed:

```typescript
// content.ts - includes all publishable libraries
export const LIBRARIES: LibraryInfo[] = [
  {
    name: 'Nexus',
    packageName: '@hyperfrontend/nexus',
    slug: 'nexus',
    readmePath: 'libs/nexus/README.md',
    entryPoints: ['libs/nexus/src/index.ts'],
    category: 'core',
  },
  {
    name: 'Logging',
    packageName: '@hyperfrontend/logging',
    slug: 'logging',
    readmePath: 'libs/logging/README.md',
    entryPoints: ['libs/logging/src/index.ts'],
    category: 'supporting',
  },
]
```

## Configuration

Apply this rule to the docs-site files that contain LIBRARIES arrays:

```javascript
// apps/docs-site/eslint.config.cjs
module.exports = [
  // ... other configs
  {
    files: ['**/src/lib/content.ts', '**/scripts/generate-docs.ts'],
    rules: {
      'workspace/docs-site-libraries': 'error',
    },
  },
]
```

## When Not To Use

- If you intentionally want to exclude certain publishable libraries from documentation
- During initial setup when documentation structure is being developed

## Related Rules

- [root-readme-packages](./root-readme-packages.md) - Ensures publishable libraries are listed in root README.md

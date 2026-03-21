# docs-site-libraries

Ensure all publishable libraries are listed in the docs-site LIBRARIES array.

## Rule Details

This rule validates that all publishable library projects from `libs/` and `plugins/` folders are included in the docs-site's LIBRARIES arrays. This ensures documentation stays in sync with publishable packages.

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

### Why?

- **Documentation completeness**: All published packages should be documented
- **Discoverability**: Users can find documentation for all available packages
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

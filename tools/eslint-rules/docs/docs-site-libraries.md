# docs-site-libraries

Ensure all publishable libraries are listed in the docs-site LIBRARIES array.

## Rule Details

This rule validates that all publishable library projects from `libs/` and `plugins/` folders are included in the docs-site's `content.ts` LIBRARIES array. This ensures documentation stays in sync with publishable packages.

### What is a Publishable Library?

A project is considered a publishable library if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined
4. Has a `package.json` with a valid `name` field

### What File is Checked?

The rule applies only to `apps/docs-site/src/lib/content.ts` and verifies that the exported `LIBRARIES` array contains entries for all publishable libraries.

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

Apply this rule to the `content.ts` file in docs-site:

```javascript
// apps/docs-site/eslint.config.cjs
module.exports = [
  // ... other configs
  {
    files: ['**/src/lib/content.ts'],
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

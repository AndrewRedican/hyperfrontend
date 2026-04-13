# lib-require-module-header

Require @module header comment at the top of entry point files in publishable libraries.

## Rule Details

This rule ensures that all entry point files (main and secondary) in publishable libraries have a JSDoc comment with a `@module` tag at the very top of the file. This improves documentation quality by providing clear module identifiers for documentation generators like TypeDoc.

### Why?

- **Documentation**: The `@module` tag provides a clear identifier for the package documentation
- **TypeDoc Integration**: Module names are used to organize API documentation
- **Discoverability**: Helps users understand what package path to import from
- **Consistency**: All entry points follow the same documentation convention

This rule only applies to publishable libraries (libraries with both `build` and `publish` targets in `project.json`).

## Examples

### ❌ Incorrect

```typescript
// src/index.ts - missing @module header
export * from './repository'
export type { Changelog } from './changelog'
```

```typescript
// src/index.ts - JSDoc without @module tag
/**
 * This is a description without module tag.
 */
export * from './repository'
```

```typescript
// src/index.ts - line comment instead of JSDoc
// @module @hyperfrontend/repo-utils
export * from './repository'
```

```typescript
// src/index.ts - JSDoc not at line 1

/**
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
```

### ✅ Correct

```typescript
/**
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
export type { Changelog } from './changelog'
```

```typescript
/**
 * Repository utilities for managing Git repositories.
 *
 * This package provides:
 * - Repository scanning and analysis
 * - Changelog parsing and generation
 * - Version management utilities
 *
 * @module @hyperfrontend/repo-utils
 */
export * from './repository'
export type { Changelog } from './changelog'
```

### Secondary Entry Points

Secondary entry points must also have `@module` headers with the appropriate subpath:

```typescript
// src/changelog/index.ts
/**
 * @module @hyperfrontend/repo-utils/changelog
 */
export type { Changelog } from './models'
export { parseChangelog } from './parser'
```

## Entry Point Detection

An index.ts file is considered an entry point if:

1. It is in a publishable library (`project.json` has `projectType: 'library'` with `build` and `publish` targets)
2. It corresponds to an export in `package.json`:
   - Main entry: `src/index.ts` (maps to `"."` export)
   - Secondary entry: Any path declared in `exports` (e.g., `"./changelog": "./src/changelog/index.js"`)

Files that don't match these criteria are ignored by this rule.

## Options

This rule has no configurable options.

## When Not To Use It

You may want to disable this rule if:

- You don't use TypeDoc or similar documentation generators
- Your project has its own documentation conventions that don't use `@module`

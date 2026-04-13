# lib-entry-export-spacing

Enforce no blank lines between exports in entry point files.

## Rule Details

This rule ensures that export statements in library entry points (both main and secondary) are written without blank lines between them. Entry points are determined by the `exports` field in `package.json`.

### Why?

- **Density**: Entry points are compact API surfaces – blank lines waste vertical space
- **Consistency**: All entry points follow the same formatting convention
- **Scanability**: Dense exports are easier to scan quickly
- **Maintainability**: Prevents style drift as contributors add exports

This rule only applies to publishable libraries (libraries with both `build` and `publish` targets in `project.json`).

## Examples

### ❌ Incorrect

```typescript
// src/index.ts
export * from './repository'

export type { Changelog } from './changelog/models/changelog'

export { parseChangelog } from './changelog/parse/parser'
```

```typescript
// src/models/index.ts (secondary entry point)
export type { Model } from './model'

export { createModel } from './factory'
```

### ✅ Correct

```typescript
// src/index.ts
export * from './repository'
export type { Changelog } from './changelog/models/changelog'
export { parseChangelog } from './changelog/parse/parser'
```

```typescript
// src/models/index.ts (secondary entry point)
export type { Model } from './model'
export { createModel } from './factory'
```

### ✅ Correct (comments between exports are allowed)

```typescript
// src/index.ts
export * from './repository'
// Changelog types
export type { Changelog } from './changelog/models/changelog'
// Parser
export { parseChangelog } from './changelog/parse/parser'
```

## Entry Point Detection

An index.ts file is considered an entry point if:

1. It is in a publishable library (`project.json` has `projectType: 'library'` with `build` and `publish` targets)
2. It corresponds to an export in `package.json`:
   - Main entry: `src/index.ts` (maps to `"."` export)
   - Secondary entry: Any path declared in `exports` (e.g., `"./models": "./src/models/index.js"`)

Files that don't match these criteria are ignored by this rule.

## Options

This rule has no configurable options.

## When Not To Use It

If you prefer visual grouping of exports with blank lines over density, disable this rule.

## Fixable

This rule is auto-fixable. Run ESLint with the `--fix` flag to automatically remove blank lines between exports.

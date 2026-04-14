# export-order

Enforce export ordering (type-first, by source category).

## Rule Details

This rule enforces a consistent export order for re-exports to improve code readability and maintainability. Exports are sorted in the following order:

1. Type exports (using `export type`)
2. Node.js built-in modules (`node:` prefix)
3. External packages
4. Workspace packages (`@hyperfrontend/`)
5. Relative exports (sorted by depth, deeper paths first)
6. Current directory exports (`./`)

This rule only applies to re-exports (exports with a source). Declaration exports like `export const`, `export function`, and `export class` are not affected.

### Why?

- **Readability**: Consistent ordering makes it easier to scan exports
- **Merge conflicts**: Predictable ordering reduces merge conflicts
- **Maintainability**: Clear separation between different export types
- **Consistency**: Mirrors the `import-order` rule for a uniform codebase style

## Examples

### ❌ Incorrect

```typescript
export { helper } from './helper'
export type { Config } from './types'
export { readFileSync } from 'node:fs'
export { someUtil } from '@hyperfrontend/utils'
export { default as express } from 'express'
```

### ✅ Correct

```typescript
export type { Config } from './types'
export { readFileSync } from 'node:fs'
export { default as express } from 'express'
export { someUtil } from '@hyperfrontend/utils'
export { helper } from './helper'
```

### ✅ Also Correct (with export all)

```typescript
export type * from './types'
export * from 'node:fs'
export * from 'express'
export * from '@hyperfrontend/utils'
export * from './helper'
```

## Options

This rule has no configurable options.

## When Not To Use It

If you use a different export ordering convention or another tool with its own ordering rules.

## Fixable

This rule is auto-fixable. Run ESLint with the `--fix` flag to automatically reorder exports.

## Related Rules

- [import-order](./import-order.md) - Enforces consistent import ordering

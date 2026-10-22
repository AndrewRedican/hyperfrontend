# no-unwanted-barrel-files

Disallow barrel files (index.ts) that are not declared as entry points.

## Rule Details

This rule prevents the creation of barrel files (`index.ts`) in directories that are not declared as package entry points in `package.json` exports.

### Why?

- **Tree-shaking**: Barrel files can prevent effective tree-shaking
- **Circular dependencies**: Barrel files often introduce circular import issues
- **Bundle size**: Re-exporting everything increases bundle size
- **Import clarity**: Direct imports are more explicit about dependencies

## Examples

### ❌ Incorrect

Creating `src/utils/index.ts` when it's not in package.json exports:

```typescript
// src/utils/index.ts - NOT ALLOWED
export * from './helper'
export * from './formatter'
export * from './validator'
```

### ✅ Correct

Direct imports without barrel file:

```typescript
import { helper } from './utils/helper'
import { formatter } from './utils/formatter'
```

Or declare the entry point in package.json:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./utils": "./src/utils/index.js"
  }
}
```

## When Not To Use It

If you prefer barrel files for convenience or have a different module organization strategy.

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
- [import-order](./import-order.md)

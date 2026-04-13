# no-barrel-star-export

Disallow `export * from` in entry point barrel files.

## Rule Details

This rule prohibits star exports (`export * from '...'`) in entry point files (`index.ts`) of publishable libraries. It enforces explicit named exports to ensure a controlled and documented public API.

### Why?

- **API clarity**: Explicit exports document what is part of the public API
- **Tree-shaking**: Named exports enable more effective tree-shaking
- **Encapsulation**: Prevents accidentally exposing internal implementation details
- **Refactoring safety**: Changes to internal modules won't leak to public API
- **Documentation**: Named exports make API documentation clearer

## Examples

### ❌ Incorrect

Star exports in entry point files:

```typescript
// src/index.ts - NOT ALLOWED
export * from './utils'
export * from './models'
export * from './types'
```

Type star exports are also prohibited:

```typescript
// src/index.ts - NOT ALLOWED
export type * from './types'
```

Star exports with aliases:

```typescript
// src/index.ts - NOT ALLOWED
export * as utils from './utils'
```

### ✅ Correct

Explicit named exports:

```typescript
// src/index.ts - ALLOWED
export { formatDate, parseDate } from './utils'
export { User, Product } from './models'
export type { Config, Options } from './types'
```

Local declarations are also valid:

```typescript
// src/index.ts - ALLOWED
export const VERSION = '1.0.0'
export function initialize() {}
export type Config = { enabled: boolean }
```

## Applies To

This rule only applies to:

1. Files named `index.ts`
2. In directories that are publishable libraries (have `build` and `publish` targets)
3. That are declared as entry points in `package.json` exports

Files that are not entry points (e.g., internal barrel files) are not affected by this rule.

## When Not To Use It

If you prefer star exports for convenience and understand the trade-offs in API surface control.

## Related Rules

- [no-unwanted-barrel-files](./no-unwanted-barrel-files.md)
- [lib-entry-export-spacing](./lib-entry-export-spacing.md)
- [lib-pkg-main-reexports](./lib-pkg-main-reexports.md)

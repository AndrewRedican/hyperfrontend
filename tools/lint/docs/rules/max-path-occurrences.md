# max-path-occurrences

Limit the number of import and export statements per module path to 2.

## Rule Details

This rule enforces that each module path appears at most 2 times in import or export statements. This allows for the common pattern of separating type imports/exports from value imports/exports.

**Import consolidation** applies to all files.
**Export consolidation** applies only to barrel files (`index.ts`, `index.tsx`, `index.js`, `index.jsx`).

### Why?

- **Consolidation**: Prevents scattered imports/exports that should be grouped together
- **Clarity**: Makes it clear which imports are type-only vs value imports
- **Maintainability**: Reduces noise from excessive path repetition in barrel files
- **Best practice**: Encourages the pattern of one type import and one value import per path
- **Flexibility**: Non-barrel files can have multiple re-exports for organization purposes

## Examples

### ❌ Incorrect

```typescript
// Any file - multiple value imports from same path
import { foo } from './module'
import { bar } from './module'
```

```typescript
// Any file - multiple type imports from same path
import type { User } from './types'
import type { Config } from './types'
```

```typescript
// index.ts (barrel file) - multiple value exports from same path
export { foo } from './module'
export { bar } from './module'
```

```typescript
// index.ts (barrel file) - multiple type exports from same path
export type { User } from './types'
export type { Config } from './types'
```

### ✅ Correct

```typescript
// Consolidated imports
import type { User, Config } from './types'
import { createUser } from './types'
```

```typescript
// Consolidated exports in barrel file
export type { User, Config } from './types'
export { createUser } from './types'
```

```typescript
// Multiple exports allowed in non-barrel files
// utils.ts
export { foo } from './module'
export { bar } from './module'
```

```typescript
// Separate paths are fine
import type { User } from './user'
import type { Config } from './config'
import { createUser } from './user-factory'
```

## When Not To Use It

If your codebase intentionally uses many separate import statements for the same path (e.g., for code organization or specific tooling requirements).

## Related Rules

- [no-mixed-type-import](./no-mixed-type-import.md)
- [import-order](./import-order.md)

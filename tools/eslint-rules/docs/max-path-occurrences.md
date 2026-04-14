# max-path-occurrences

Limit the number of import and export statements per module path to 2.

## Rule Details

This rule enforces that each module path appears at most 2 times in import or export statements. This allows for the common pattern of separating type imports/exports from value imports/exports.

### Why?

- **Consolidation**: Prevents scattered imports/exports that should be grouped together
- **Clarity**: Makes it clear which imports are type-only vs value imports
- **Maintainability**: Reduces noise from excessive path repetition
- **Best practice**: Encourages the pattern of one type import and one value import per path

## Examples

### ❌ Incorrect

```typescript
import type { User } from './types'
import type { Config } from './types'
import { createUser } from './types'
```

```typescript
export type { User } from './types'
export type { Config } from './types'
export { createUser } from './types'
```

### ✅ Correct

```typescript
import type { User, Config } from './types'
import { createUser } from './types'
```

```typescript
export type { User, Config } from './types'
export { createUser } from './types'
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

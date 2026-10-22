# no-namespace-import

Prohibit namespace imports (`import * as`).

## Rule Details

This rule disallows namespace imports, requiring named imports instead.

### Why?

- **Tree-shaking**: Named imports allow bundlers to eliminate unused exports
- **Explicit dependencies**: Named imports clearly show what's being used
- **IDE support**: Better autocomplete and refactoring support
- **Bundle size**: Only import what you need

## Examples

### ❌ Incorrect

```typescript
import * as utils from './utils'
import * as lodash from 'lodash'

utils.helper()
lodash.map([1, 2, 3], (x) => x * 2)
```

### ✅ Correct

```typescript
import { helper } from './utils'
import { map } from 'lodash'

helper()
map([1, 2, 3], (x) => x * 2)
```

## Exceptions

This rule allows namespace imports for:

- **Type-only imports**: `import type * as Types from './types'`
- **JSON files**: `import * as config from './config.json'`

## When Not To Use It

- When importing modules designed for namespace usage (e.g., `import * as React from 'react'` in older React setups)
- When you intentionally want to namespace a module's exports

## Related Rules

- [no-mixed-type-import](./no-mixed-type-import.md)
- [import-order](./import-order.md)

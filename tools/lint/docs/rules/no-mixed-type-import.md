# no-mixed-type-import

Prohibit mixing type imports and value imports in a single import statement.

## Rule Details

This rule requires that type imports and value imports be in separate statements.

### Why?

- **Clarity**: Separating type and value imports makes dependencies clearer
- **Tooling**: Some tools handle type imports differently (e.g., for elision)
- **Consistency**: Establishes a predictable import structure
- **TypeScript behavior**: Type imports are erased at compile time

## Examples

### ❌ Incorrect

```typescript
import { Component, type ComponentProps, useState } from 'react'

import { helper, type HelperOptions } from './utils'
```

### ✅ Correct

```typescript
import type { ComponentProps } from 'react'
import { Component, useState } from 'react'

import type { HelperOptions } from './utils'
import { helper } from './utils'
```

## Fixable

This rule is auto-fixable. It will split mixed imports into separate type and value import statements.

## When Not To Use It

If you prefer the conciseness of mixed imports or use `verbatimModuleSyntax` in tsconfig with inline type specifiers.

## Related Rules

- [import-order](./import-order.md)
- [no-namespace-import](./no-namespace-import.md)

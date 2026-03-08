# import-order

Enforce import ordering (type-first, by source category).

## Rule Details

This rule enforces a consistent import order to improve code readability and maintainability. Imports are sorted in the following order:

1. Type imports (using `import type`)
2. Node.js built-in modules (`node:` prefix)
3. External packages
4. Workspace packages (`@hyperfrontend/`)
5. Relative imports (sorted by depth, deeper paths first)
6. Current directory imports (`./`)

### Why?

- **Readability**: Consistent ordering makes it easier to scan imports
- **Merge conflicts**: Predictable ordering reduces merge conflicts
- **Maintainability**: Clear separation between different import types

## Examples

### ❌ Incorrect

```typescript
import { helper } from './helper'
import type { Config } from './types'
import { readFileSync } from 'node:fs'
import { someUtil } from '@hyperfrontend/utils'
import express from 'express'
```

### ✅ Correct

```typescript
import type { Config } from './types'
import { readFileSync } from 'node:fs'
import express from 'express'
import { someUtil } from '@hyperfrontend/utils'
import { helper } from './helper'
```

## Options

This rule has no configurable options.

## When Not To Use It

If you use a different import ordering convention or another tool like `eslint-plugin-import` with its own ordering rules.

## Fixable

This rule is auto-fixable. Run ESLint with the `--fix` flag to automatically reorder imports.

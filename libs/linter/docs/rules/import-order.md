# import-order

Require imports to be listed type-only first, then grouped by where their source points.

## Rule Details

A predictable import order makes a file's dependencies easy to scan and keeps merge conflicts in the import block small. The rule expects this order, alphabetical by source within each group:

1. Type-only imports (`import type`), themselves ordered by the groups below
2. Node built-in modules, with the `node:` prefix or without it (`fs/promises`)
3. External packages
4. Packages in the scopes listed in [`internalScopes`](#options), when any are configured
5. Parent-directory imports (`../`), the deepest first
6. Current-directory imports (`./`)

The rule reports once, at the first import, when the imports are out of that order. The fix rewrites them in the expected order, one per line, and is offered only when the imports form one unbroken run; with a statement between two imports it reports without a fix.

## Options

| Option                       | Type       | Default | Meaning                                                                                                  |
| ---------------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------- |
| [`internalScopes`](#options) | `string[]` | `[]`    | Package scopes, such as `"@acme"`, whose packages form a group of their own after the external packages. |

Without internal scopes, a scoped package is an external package like any other.

## Examples

### ❌ Incorrect

```ts
import { helper } from './helper'
import type { Config } from './types'
import { readFileSync } from 'node:fs'
import express from 'express'
```

### ❌ Incorrect, with { "internalScopes": ["@acme"] }

<!-- options: {"internalScopes": ["@acme"]} -->

```ts
import { someUtil } from '@acme/utils'
import express from 'express'
```

### ✅ Correct

```ts
import type { Config } from './types'
import { readFileSync } from 'node:fs'
import express from 'express'
import { shared } from '../../shared'
import { core } from '../core'
import { helper } from './helper'
```

### ✅ Correct, with { "internalScopes": ["@acme"] }

<!-- options: {"internalScopes": ["@acme"]} -->

```ts
import { readFileSync } from 'node:fs'
import express from 'express'
import { someUtil } from '@acme/utils'
import { helper } from './helper'
```

## When Not To Use It

When another tool, such as a formatter plugin, already owns import ordering with its own convention. The same grouping applies to re-exports in [export-order](./export-order.md).

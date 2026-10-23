# export-order

Require re-exports to be listed type-only first, then grouped by where their source points.

## Rule Details

The rule applies the grouping of [import-order](./import-order.md) to re-exports, the `export ... from` and `export * from` statements of an index file. The expected order, alphabetical by source within each group:

1. Type-only re-exports (`export type`), themselves ordered by the groups below
2. Node built-in modules, with the `node:` prefix or without it
3. External packages
4. Packages in the scopes listed in [`internalScopes`](#options), when any are configured
5. Parent-directory sources (`../`), the deepest first
6. Current-directory sources (`./`)

Exports of local declarations, such as `export const` or `export function`, are not ordered. The rule reports once, at the first re-export, when the re-exports are out of order. The fix rewrites them in the expected order, one per line, and is offered only when the re-exports form one unbroken run.

## Options

| Option                       | Type       | Default | Meaning                                                                                                  |
| ---------------------------- | ---------- | ------- | -------------------------------------------------------------------------------------------------------- |
| [`internalScopes`](#options) | `string[]` | `[]`    | Package scopes, such as `"@acme"`, whose packages form a group of their own after the external packages. |

Without internal scopes, a scoped package is an external package like any other.

## Examples

### ❌ Incorrect

```ts
export { helper } from './helper'
export type { Config } from './types'
export { readFileSync } from 'node:fs'
export { default as express } from 'express'
```

### ❌ Incorrect, with { "internalScopes": ["@acme"] }

<!-- options: {"internalScopes": ["@acme"]} -->

```ts
export * from '@acme/utils'
export * from 'express'
```

### ✅ Correct

```ts
export type { Config } from './types'
export { readFileSync } from 'node:fs'
export { default as express } from 'express'
export { helper } from './helper'
```

### ✅ Correct, with { "internalScopes": ["@acme"] }

<!-- options: {"internalScopes": ["@acme"]} -->

```ts
export type * from './types'
export * from 'express'
export * from '@acme/utils'
export * from './helper'
```

## When Not To Use It

When another tool already owns the order of re-exports with its own convention.

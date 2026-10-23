# no-namespace-import

Forbid namespace imports (`import * as name`) in favour of named imports.

## Rule Details

A namespace import hides which of a module's exports a file uses, and some bundlers keep every export of a module imported that way. Named imports say what is used and let unused exports be dropped. The rule reports each namespace import specifier. The rule does not fix.

Two kinds of namespace import are allowed: a type-only one (`import type * as Types from './types'`), which is erased at compile time, and one whose source ends in `.json`, since a JSON module has no named exports to pick.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import * as utils from './utils'

utils.helper()
```

### ✅ Correct

```ts
import { helper } from './utils'
import type * as Types from './types'
import * as config from './config.json'

helper()
```

## When Not To Use It

For modules designed to be used as a namespace, or where a file deliberately groups a module's exports under one name.

## Limitations

Namespace re-exports (`export * as utils from './utils'`) are not reported.

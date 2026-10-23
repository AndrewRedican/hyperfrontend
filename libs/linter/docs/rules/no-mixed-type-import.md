# no-mixed-type-import

Forbid an import that mixes inline `type` specifiers with value specifiers.

## Rule Details

An import that names types and values together hides which names the compiled module still needs: the types are erased, the values stay. Keeping them in an `import type` statement and a plain import makes the split visible and gives tools that elide types one statement to drop. The rule reports an import whose named specifiers include both ones marked `type` and unmarked ones. The fix splits it into an `import type { … }` and a plain import of the same source; a default import stays with the values, and each specifier keeps its alias.

An import whose named specifiers are all marked `type`, or none of them, is not reported.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import { Component, type ComponentProps, useState } from 'react'

import { helper, type HelperOptions as Options } from './utils'
```

### ✅ Correct

```ts
import type { ComponentProps } from 'react'
import { Component, useState } from 'react'

import type { HelperOptions as Options } from './utils'
import { helper } from './utils'
```

## When Not To Use It

When a project prefers the brevity of inline type specifiers. The same split for exports is [no-mixed-type-export](./no-mixed-type-export.md).

## Limitations

A default import beside named specifiers that are all marked `type`, as in `import React, { type FC } from 'react'`, is not reported, since no named value specifier is present.

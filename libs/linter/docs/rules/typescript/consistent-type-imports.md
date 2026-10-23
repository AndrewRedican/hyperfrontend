# typescript/consistent-type-imports

Require `import type` for imports used only as types, and forbid `import()` type annotations.

## Rule Details

A type-only import is erased by the compiler, so marking it keeps the emitted module free of imports it never needs. This rule reports a value import declaration whose bindings are used only in type positions, including `typeof` queries and computed keys of property signatures. A re-exported binding counts as a value use. A declaration with import attributes is left alone. The fix adds `type` when every binding is type-only, and otherwise moves the type-only bindings to a separate `import type` of the same module, joining one that already exists. The rule also reports `import('...')` used as a type annotation, without a fix.

Reimplements [typescript-eslint's `consistent-type-imports`](https://typescript-eslint.io/rules/consistent-type-imports).

## Options

| Option                                                                                                           | Type                      | Default                   | Meaning                                     |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------- | ------------------------------------------- |
| [`disallowTypeAnnotations`](https://typescript-eslint.io/rules/consistent-type-imports/#disallowtypeannotations) | boolean                   | true                      | Report `import()` type annotations.         |
| [`prefer`](https://typescript-eslint.io/rules/consistent-type-imports/#prefer)                                   | `'type-imports'`          | `'type-imports'`          | Accepted for compatibility; the only value. |
| [`fixStyle`](https://typescript-eslint.io/rules/consistent-type-imports/#fixstyle)                               | `'separate-type-imports'` | `'separate-type-imports'` | Accepted for compatibility; the only value. |

The original's `'no-type-imports'` preference and `'inline-type-imports'` fix style are not supported.

## Examples

### ❌ Incorrect

```ts
import { Config, load } from './config'

export const read = (path: string): Config => load(path)
```

```ts
let config: import('./config').Config
```

### ✅ Correct

```ts
import type { Config } from './config'
import { load } from './config'

export const read = (path: string): Config => load(path)
```

## Limitations

The original keeps value imports that decorator metadata needs when [`emitDecoratorMetadata`](https://www.typescriptlang.org/tsconfig/#emitDecoratorMetadata) and [`experimentalDecorators`](https://www.typescriptlang.org/tsconfig/#experimentalDecorators) are on. This rule does not read compiler options, so in that setup a class used only in decorated signatures is still reported.

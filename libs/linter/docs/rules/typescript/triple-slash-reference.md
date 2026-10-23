# typescript/triple-slash-reference

Forbid `/// <reference path>` directives, and `/// <reference types>` directives for a module the file also imports.

## Rule Details

A triple-slash reference pulls a file or a types package into the program from a comment, where an `import` would state the dependency in code. This rule reads the reference directives before the first statement. It reports every `path=` reference, and a `types=` reference whenever the same module is also imported with an `import` declaration or `import x = require()`, once per such import. A `lib=` reference passes, since nothing can import a built-in library declaration. It does not fix.

Reimplements [typescript-eslint's `triple-slash-reference`](https://typescript-eslint.io/rules/triple-slash-reference).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/triple-slash-reference/#options), which set the policy for each kind of reference, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/// <reference path="./globals.d.ts" />
/// <reference types="node" />
import { readFileSync } from 'node'
```

### ✅ Correct

```ts
/// <reference lib="dom" />
/// <reference types="vite/client" />
import { readFileSync } from 'node:fs'
```

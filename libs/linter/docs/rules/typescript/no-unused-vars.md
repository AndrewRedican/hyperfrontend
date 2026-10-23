# typescript/no-unused-vars

Forbid variables, parameters, imports, types and namespaces that are declared and never used.

## Rule Details

A declaration nothing reads is dead code or a sign of a mistake, such as a misspelt name or a forgotten call. This rule reports it at the declaration, or at its last write in its own scope when it is only ever assigned. A read that serves only the variable's own update, such as `count += 1` as a statement, does not count as a use, and neither does a function or type referring to itself. A value read only inside `typeof` queries is reported as used only as a type, unless it is an import. Exported declarations count as used, as do the declarations of a declaration file or a `declare namespace` that has no explicit export list. It does not fix.

Parameters before the last used one, setter parameters, parameters of signatures and function types, constructor parameter properties, enum members and mapped type keys are never reported. Unused `catch` bindings and properties destructured beside a rest element are reported.

Reimplements [typescript-eslint's `no-unused-vars`](https://typescript-eslint.io/rules/no-unused-vars).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-unused-vars/#options), among them the ignore patterns for names such as a leading underscore, the parameter and caught-error modes, and the rest-sibling exemption, are not read: the behaviour is fixed to the original's defaults, with no ignore pattern.

## Examples

### ❌ Incorrect

```ts
import { readFileSync } from 'node:fs'

let attempts = 0
attempts += 1

export function greet(name: string, _unused: number) {
  const greeting = `Hello, ${name}`
}
```

### ✅ Correct

```ts
import { readFileSync } from 'node:fs'

export function load(_path: string, encoding: BufferEncoding) {
  return readFileSync('config.json', encoding)
}
```

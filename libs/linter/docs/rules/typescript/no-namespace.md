# typescript/no-namespace

Forbid TypeScript namespaces and `module Name` blocks outside declaration files.

## Rule Details

ES modules already give every file its own scope and an explicit import and export surface, so a namespace adds a second, older way to group code. This rule reports every `namespace Name {}` and `module Name {}` declaration in a source file. Declaration files (`.d.ts`) are exempt, since ambient namespaces there describe globals that already exist. A `declare global {}` augmentation and an ambient module named by a string, such as `declare module 'pkg' {}`, pass everywhere. It does not fix.

Reimplements [typescript-eslint's `no-namespace`](https://typescript-eslint.io/rules/no-namespace).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-namespace/#options), which allow `declare` namespaces in source files or turn off the declaration-file exemption, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
namespace Geometry {
  export const origin = { x: 0, y: 0 }
}
```

### ✅ Correct

```ts
export const origin = { x: 0, y: 0 }

declare module 'legacy-lib' {
  export const version: string
}

declare global {
  interface Window {
    analytics: unknown
  }
}
```

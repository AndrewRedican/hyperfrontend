# typescript/prefer-namespace-keyword

Require `namespace` rather than `module` to declare a TypeScript namespace.

## Rule Details

`module Name {}` is the old spelling of a namespace, and it reads as though it declared an ES module. This rule reports a namespace declared with the `module` keyword and an identifier name, dotted names included. An ambient module named by a string, such as `declare module 'pkg' {}`, is a different construct and passes. The fix replaces the keyword with `namespace`.

Reimplements [typescript-eslint's `prefer-namespace-keyword`](https://typescript-eslint.io/rules/prefer-namespace-keyword).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
declare module Shapes {
  const sides: number
}
```

### ✅ Correct

```ts
declare namespace Shapes {
  const sides: number
}

declare module 'shapes' {
  export const sides: number
}
```

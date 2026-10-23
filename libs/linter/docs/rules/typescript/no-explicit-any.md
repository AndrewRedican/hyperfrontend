# typescript/no-explicit-any

Forbid writing the `any` type.

## Rule Details

The `any` type switches type checking off for every value it touches, and the loss spreads through whatever the value flows into. This rule reports every `any` written in a type position, so that a precise type is chosen, or `unknown` where the type really is not known and must be narrowed before use. It does not fix.

Reimplements [typescript-eslint's `no-explicit-any`](https://typescript-eslint.io/rules/no-explicit-any).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-explicit-any/#options), which offer an `unknown` fix and exempt `any[]` in rest parameters, are not read.

## Examples

### ❌ Incorrect

```ts
function parse(text: string): any {
  return JSON.parse(text)
}
```

### ✅ Correct

```ts
function parse(text: string): unknown {
  return JSON.parse(text)
}
```

## Limitations

The original offers suggestions that replace `any` with `unknown` or `never`; this rule reports without them.

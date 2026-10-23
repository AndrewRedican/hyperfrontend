# typescript/prefer-as-const

Require `as const` over asserting or annotating a literal with its own literal type.

## Rule Details

`'get' as 'get'` and `let method: 'get' = 'get'` write the same literal twice, and the two copies can drift apart in an edit. `as const` says it once. This rule reports a string, number or boolean literal asserted or annotated with a literal type spelt exactly the same, on variables and class properties. The fix rewrites an assertion to `as const`; an annotation is reported without a fix, because removing it changes the declared type.

Reimplements [typescript-eslint's `prefer-as-const`](https://typescript-eslint.io/rules/prefer-as-const).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const request = { method: 'get' as 'get' }
let mode: 'strict' = 'strict'
```

### ✅ Correct

```ts
const request = { method: 'get' as const }
let mode = 'strict' as const
let level: 'low' | 'high' = 'low'
```

## Limitations

The literal and its type are compared as written, so `'get' as "get"` is not reported. The original offers a suggestion for the annotation case; this rule reports without one.

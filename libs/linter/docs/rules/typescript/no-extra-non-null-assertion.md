# typescript/no-extra-non-null-assertion

Forbid non-null assertions that have no effect.

## Rule Details

A second `!` on an already asserted value changes nothing, and a `!` directly before an optional chain contradicts it: the assertion says the value is never nullish while `?.` says it may be. This rule reports a non-null assertion that is asserted again, or that is the object of an optional member access or the callee of an optional call. The fix removes the extra `!`.

Reimplements [typescript-eslint's `no-extra-non-null-assertion`](https://typescript-eslint.io/rules/no-extra-non-null-assertion).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const name = user!!.name
const size = list!?.length
const result = handler!?.()
```

### ✅ Correct

```ts
const name = user!.name
const size = list?.length
const result = handler?.()
```

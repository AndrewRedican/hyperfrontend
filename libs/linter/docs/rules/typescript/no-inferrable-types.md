# typescript/no-inferrable-types

Forbid type annotations that repeat the type of a literal initializer.

## Rule Details

`const count: number = 0` says twice what `const count = 0` says once. This rule reports an annotation of `bigint`, `boolean`, `null`, `number`, `string`, `symbol`, `undefined` or `RegExp` on a variable, a parameter with a default, or a class property, when the initializer is plainly a value of that type: a literal, a template, a negated or signed number, `!x`, `void x`, `NaN`, `Infinity`, or a call of the matching global such as `String(x)` or `new RegExp(x)`. Readonly and optional properties are left alone, since there the annotation widens a literal type. The fix removes the annotation, together with the `?` of an optional parameter or the `!` of a definite property that would be left dangling.

Reimplements [typescript-eslint's `no-inferrable-types`](https://typescript-eslint.io/rules/no-inferrable-types).

## Options

This rule has no options. The [original's options](https://typescript-eslint.io/rules/no-inferrable-types/#options), which exempt parameters or properties, are not read: both are always checked.

## Examples

### ❌ Incorrect

```ts
const retries: number = 3
const label: string = `retry ${retries}`

function wait(ms: number = 100) {
  return ms
}
```

### ✅ Correct

```ts
const retries = 3
const label = `retry ${retries}`

function wait(ms = 100) {
  return ms
}
```

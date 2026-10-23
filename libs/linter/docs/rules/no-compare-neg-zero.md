# no-compare-neg-zero

Forbid comparing a value against `-0` with a comparison operator.

## Rule Details

Every equality and relational operator treats `-0` and `0` as the same value, so `x === -0` is also true for `0` and never tells them apart. The rule reports a comparison (`==`, `===`, `!=`, `!==`, `<`, `<=`, `>`, `>=`) with `-0` written as either operand. To test for negative zero, use `Object.is(x, -0)`. The rule does not fix.

Reimplements [ESLint's `no-compare-neg-zero`](https://eslint.org/docs/latest/rules/no-compare-neg-zero).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
if (x === -0) {
  reset()
}
```

### ✅ Correct

```ts
if (Object.is(x, -0)) {
  reset()
}

if (x === 0) {
  reset()
}
```

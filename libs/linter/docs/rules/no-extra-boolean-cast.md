# no-extra-boolean-cast

Forbid `!!value` and `Boolean(value)` where the value is already read as a boolean.

## Rule Details

The test of an `if`, a loop or a conditional expression, the operand of `!` and the argument of `Boolean()` all convert their value to a boolean already, so a cast there adds nothing but noise. The rule reports a double negation (`!!value`) or a `Boolean(...)` call, with or without `new`, in one of those places.

The fix removes the cast and keeps the parentheses the bare value then needs: `if (!!a)` becomes `if (a)`, `!Boolean(a && b)` becomes `!(a && b)`, `Boolean()` becomes `false`. It is withheld when a comment inside the cast would be lost, or when the call spreads its argument or takes more than one.

Reimplements [ESLint's `no-extra-boolean-cast`](https://eslint.org/docs/latest/rules/no-extra-boolean-cast).

## Options

This rule has no options. The original's [`enforceForInnerExpressions`](https://eslint.org/docs/latest/rules/no-extra-boolean-cast#options) and [`enforceForLogicalOperands`](https://eslint.org/docs/latest/rules/no-extra-boolean-cast#options) options are not read, so a cast that is an operand of `&&`, `||` or `??` inside a test is not reported.

## Examples

### ❌ Incorrect

```ts
if (!!user) {
  greet(user)
}

const missing = !Boolean(user)

while (Boolean(queue.length)) {
  queue.pop()
}
```

### ✅ Correct

```ts
if (user) {
  greet(user)
}

const present = !!user
const flag = Boolean(user)
```

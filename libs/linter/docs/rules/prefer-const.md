# prefer-const

Require `const` for `let` variables that are never reassigned.

## Rule Details

A `let` that is assigned once and never again is a constant in all but name. Declaring it `const` tells the reader the binding will not change and makes an accidental reassignment an error. The rule reports each `let` variable written exactly once, by its initialiser or by a single later assignment in the same scope, and read after that. A destructuring is judged variable by variable, so `let { a, b } = options` reports `a` alone when only `b` is reassigned. The counter declared in the head of a classic `for` loop is never reported; the variable of a `for...of` or `for...in` loop is.

The fix rewrites `let` as `const`. It is offered only when every variable of the declaration qualifies and the declaration initialises each of them, or heads a `for...of` or `for...in` loop; a variable declared without a value and assigned later is reported without a fix.

Reimplements [ESLint's `prefer-const`](https://eslint.org/docs/latest/rules/prefer-const).

## Options

This rule has no options. The original's options are not read: [`destructuring`](https://eslint.org/docs/latest/rules/prefer-const#options) is fixed to `"any"` and [`ignoreReadBeforeAssign`](https://eslint.org/docs/latest/rules/prefer-const#options) to `false`, the original's defaults.

## Examples

### ❌ Incorrect

```ts
let total = compute()
print(total)

for (let item of items) {
  print(item)
}

let { port, host } = options
host = 'localhost'
print(port, host)
```

### ✅ Correct

```ts
const total = compute()
print(total)

let count = 0
count += 1

for (let index = 0; index < 3; print(index)) {}
```

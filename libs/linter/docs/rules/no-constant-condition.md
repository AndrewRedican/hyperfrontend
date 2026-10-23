# no-constant-condition

Forbid conditions that always hold or never do.

## Rule Details

A test that cannot change, such as `if (true)` or `while (1)`, is usually a leftover of debugging or a mistake that makes a branch dead. The rule reports a constant test of an `if`, a conditional (`?:`) expression, and a `while`, `do...while` or `for` loop. Constant means the value is known from the code alone: literals, object and function expressions, `typeof` results, and the like.

Two loop forms pass: `while (true)`, the idiom for a loop that ends by `break`, and any constant loop that a `yield` inside it can suspend, since the consumer of the generator decides when it ends. A `for (;;)` loop has no test and is not reported. The rule does not fix.

Reimplements [ESLint's `no-constant-condition`](https://eslint.org/docs/latest/rules/no-constant-condition), in its default mode.

## Options

This rule has no options. The original's [`checkLoops`](https://eslint.org/docs/latest/rules/no-constant-condition#options) option is not read: every loop except `while (true)` is checked, the original's default.

## Examples

### ❌ Incorrect

```ts
if (false) {
  debug()
}

while (1) {
  poll()
}

const label = typeof value ? 'set' : 'unset'
```

### ✅ Correct

```ts
if (ready) {
  run()
}

while (true) {
  if (poll()) break
}

function* ids() {
  for (let id = 0; true; id++) yield id
}
```

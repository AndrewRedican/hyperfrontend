# for-direction

Forbid a `for` loop whose update moves the counter away from the bound its test checks.

## Rule Details

A loop such as `for (let i = 0; i < 10; i--)` never ends by its test, which is almost always a typo in the update. The rule reports a `for` loop whose test compares a counter with `<`, `<=`, `>` or `>=` and whose update moves that counter the wrong way: `i++` or `i--`, or `i += n` and `i -= n` where the step is known without running the code (a literal, arithmetic on literals, or a variable assigned once with such a value). An unknown or zero step is not reported. The rule does not fix.

Reimplements [ESLint's `for-direction`](https://eslint.org/docs/latest/rules/for-direction).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
for (let i = 0; i < 10; i--) {}

for (let i = 10; i >= 0; i++) {}

const step = -1
for (let i = 0; i < 10; i += step) {}
```

### ✅ Correct

```ts
for (let i = 0; i < 10; i++) {}

for (let i = 10; i >= 0; i -= 2) {}

for (let i = 0; i < 10; i += step()) {}
```

# no-shadow-restricted-names

Forbid declaring a binding named `undefined`, `NaN`, `Infinity`, [`arguments`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments) or [`eval`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval).

## Rule Details

These names refer to values and functions the language provides. A local binding of the same name hides them, so `NaN` or `undefined` in that scope no longer means what every reader expects. The rule reports each declaration of one of these names: variables, function and class names, parameters, `catch` parameters and imports. A `let undefined` or `var undefined` declared without an initialiser and never assigned is allowed, since its value is still `undefined`. The rule does not fix.

Reimplements [ESLint's `no-shadow-restricted-names`](https://eslint.org/docs/latest/rules/no-shadow-restricted-names).

## Options

This rule has no options. The original's [`reportGlobalThis`](https://eslint.org/docs/latest/rules/no-shadow-restricted-names#options) option is not read, and a binding named `globalThis` is never reported.

## Examples

### ❌ Incorrect

```ts
const NaN = 0
function check(Infinity: number) {}
const undefined = null
try {
  run()
} catch (undefined) {}
```

### ✅ Correct

```ts
const notANumber = Number.NaN
function check(limit: number) {}
let undefined
```

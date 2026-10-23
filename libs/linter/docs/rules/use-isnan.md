# use-isnan

Require `Number.isNaN()` instead of comparing with `NaN`.

## Rule Details

`NaN` is the one value that is not equal to itself, so `value === NaN` is always false and `value !== NaN` always true, whatever the value. The rule reports a comparison (`==`, `===`, `!=`, `!==`, `<`, `>`, `<=`, `>=`) with `NaN` or `Number.NaN` on either side. By default it also reports `switch (NaN)` and `case NaN:`, which can never match for the same reason. Use `Number.isNaN(value)`. The rule does not fix.

Reimplements [ESLint's `use-isnan`](https://eslint.org/docs/latest/rules/use-isnan).

## Options

| Option                             | Type      | Default | Meaning                                              |
| ---------------------------------- | --------- | ------- | ---------------------------------------------------- |
| [`enforceForSwitchCase`](#options) | `boolean` | `true`  | Whether `switch (NaN)` and `case NaN:` are reported. |

The original's [`enforceForIndexOf`](https://eslint.org/docs/latest/rules/use-isnan#enforceforindexof) option is not read, so `indexOf(NaN)` and `lastIndexOf(NaN)` are not reported.

## Examples

### ❌ Incorrect

```ts
if (value === NaN) {
  reset()
}

switch (value) {
  case NaN:
    reset()
}
```

### ✅ Correct

```ts
if (Number.isNaN(value)) {
  reset()
}
```

### ✅ Correct, with { "enforceForSwitchCase": false }

<!-- options: {"enforceForSwitchCase": false} -->

```ts
switch (value) {
  case NaN:
    reset()
}
```

## Limitations

The original offers suggestions that rewrite a comparison as a `Number.isNaN()` call; this rule reports without them.

# no-fallthrough

Forbid a `switch` case from falling through into the next one without a comment saying so.

## Rule Details

When the end of a case can be reached, control runs on into the next case. That is sometimes intended and far more often a forgotten `break`. The rule follows the code paths of each case and reports the next case when the end of the previous one is reachable: no `break`, `return`, `throw` or `continue` stops every path.

A comment says the fall-through is meant when it contains "falls through", "fall through" or "fallthrough", in any letter case, and is the last comment before the next case, or the last one inside a block that is the case's only statement. Linter directive comments do not count. An empty case directly above the next one, as in `case 'a': case 'b':`, is a shared label and passes; one separated from the next case by a line is reported. The rule does not fix.

Reimplements [ESLint's `no-fallthrough`](https://eslint.org/docs/latest/rules/no-fallthrough).

## Options

This rule has no options. The original's options [`commentPattern`](https://eslint.org/docs/latest/rules/no-fallthrough#options), [`allowEmptyCase`](https://eslint.org/docs/latest/rules/no-fallthrough#options) and [`reportUnusedFallthroughComment`](https://eslint.org/docs/latest/rules/no-fallthrough#options) are not read.

## Examples

### ❌ Incorrect

```ts
switch (kind) {
  case 'warn':
    log(kind)
  case 'error':
    alert(kind)
}
```

### ✅ Correct

```ts
switch (kind) {
  case 'warn':
    log(kind)
    break
  case 'error':
    alert(kind)
}

switch (kind) {
  case 'info':
  case 'warn':
    log(kind)
  // falls through
  case 'error':
    alert(kind)
}
```

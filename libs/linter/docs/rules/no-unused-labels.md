# no-unused-labels

Forbid labels that no `break` or `continue` names.

## Rule Details

A label exists to be the target of a `break` or `continue`. One that nothing targets is noise, and often a sign that the jump it was written for was removed or names a different label. The rule reports every label that no `break` or `continue` inside its statement names. The fix removes the label and its colon, leaving the statement. It is withheld when a comment sits between the label and the statement, or when removing the label would leave a string literal in a position where it would become a directive such as `"use strict"`.

Reimplements [ESLint's `no-unused-labels`](https://eslint.org/docs/latest/rules/no-unused-labels).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
outer: for (const row of rows) {
  if (row.empty) break
}
```

### ✅ Correct

```ts
outer: for (const row of rows) {
  for (const cell of row.cells) {
    if (cell.done) continue outer
  }
}
```

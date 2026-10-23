# no-duplicate-case

Forbid two `case` labels in one `switch` that are written the same way.

## Rule Details

A `switch` runs the first clause whose label matches, so a second clause with the same label can never be reached, which usually means a label was copied and not changed. The rule reports every clause whose label repeats an earlier label of the same `switch`, compared token by token, so `case a.b:` and `case a . b:` count as the same and `case 1:` and `case 1.0:` do not. The rule does not fix.

Reimplements [ESLint's `no-duplicate-case`](https://eslint.org/docs/latest/rules/no-duplicate-case).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
switch (kind) {
  case 'file':
    open()
    break
  case 'folder':
    expand()
    break
  case 'file':
    preview()
    break
}
```

### ✅ Correct

```ts
switch (kind) {
  case 'file':
    open()
    break
  case 'folder':
    expand()
    break
  case 'link':
    follow()
    break
}
```

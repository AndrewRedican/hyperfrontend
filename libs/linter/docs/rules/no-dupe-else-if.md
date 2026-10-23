# no-dupe-else-if

Forbid an `else if` branch whose condition repeats, or is covered by, an earlier condition of the same chain.

## Rule Details

In an `if`/`else if` chain only the first matching branch runs, so a later branch whose condition an earlier one already decides can never run. That is almost always a copy-and-paste slip where a different condition was meant. The rule compares each branch's condition with the conditions before it, token by token, and understands `||` and `&&`: a branch is reported when every way its condition can hold is already caught above, so `a && b` after `a` is reported, and `a || b` after `a` and then `b` is reported. Operands are compared as written, without evaluating them. The rule does not fix.

Reimplements [ESLint's `no-dupe-else-if`](https://eslint.org/docs/latest/rules/no-dupe-else-if).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
if (isAdmin) {
  grant()
} else if (isEditor) {
  review()
} else if (isAdmin) {
  audit()
}

if (a) {
  first()
} else if (a && b) {
  second()
}
```

### ✅ Correct

```ts
if (isAdmin) {
  grant()
} else if (isEditor) {
  review()
} else if (isViewer) {
  audit()
}

if (a && b) {
  first()
} else if (a) {
  second()
}
```

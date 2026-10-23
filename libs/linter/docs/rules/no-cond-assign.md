# no-cond-assign

Forbid an assignment as the test of a condition unless it is wrapped in its own parentheses.

## Rule Details

`if (user = find(id))` is usually a mistyped comparison. When the assignment is meant, wrapping it in a second pair of parentheses says so. The rule reports an assignment that is the whole test of an `if`, `while`, `do...while`, `for` or conditional (`?:`) expression and is not parenthesised on its own: two pairs for an `if`, a loop or a ternary, one pair for a `for` loop, whose head parentheses do not count. The rule does not fix.

Reimplements [ESLint's `no-cond-assign`](https://eslint.org/docs/latest/rules/no-cond-assign), in its default `"except-parens"` mode.

## Options

This rule has no options. The original's string option is not read, so its `"always"` mode, which reports every assignment in a test even when parenthesised, is not available.

## Examples

### ❌ Incorrect

<!-- prettier-ignore -->
```ts
if (user = find(id)) {
  greet(user)
}

while (node = node.next) {}
```

### ✅ Correct

```ts
if ((user = find(id))) {
  greet(user)
}

if (user === find(id)) {
  greet(user)
}
```

## Limitations

Only an assignment that is the whole test is checked, as in the original's default mode: one nested inside it, as in `if (ready && (value = read()))`, is not reported.

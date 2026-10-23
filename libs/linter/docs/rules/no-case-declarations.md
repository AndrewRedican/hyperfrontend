# no-case-declarations

Forbid `let`, `const`, function and class declarations directly under a `case` or `default` clause.

## Rule Details

A declaration directly under a case clause belongs to the whole `switch` block, so every clause can see it, but it is only initialised when its own clause runs. Reaching it from another clause throws, or, for a function, quietly works only after hoisting. Wrapping the clause body in braces gives the declaration a block of its own. The rule reports every `let`, `const`, [`using`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/using), function and class declaration that is a direct statement of a clause; `var` is left alone. The rule does not fix.

Reimplements [ESLint's `no-case-declarations`](https://eslint.org/docs/latest/rules/no-case-declarations).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
switch (kind) {
  case 'a':
    const label = 'first'
    break
  default:
    function fallback() {}
}
```

### ✅ Correct

```ts
switch (kind) {
  case 'a': {
    const label = 'first'
    break
  }
  default: {
    function fallback() {}
  }
}
```

## Limitations

The original offers a suggestion that wraps the clause body in braces; this rule reports without one.

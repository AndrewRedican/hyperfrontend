# no-var

Require `let` or `const` instead of `var`.

## Rule Details

A `var` is scoped to its whole function rather than to its block, is hoisted above its declaration, and may be redeclared, so it leaks out of loops and conditionals in ways `let` and `const` do not. The rule reports every `var` declaration, except one inside a `declare global` block, where TypeScript only accepts `var`.

The fix turns `var` into `let` only where the change keeps the program's meaning: the variable is declared once, used only inside its block and after its declaration, does not become a property of the global object at the top level of a script, and is not a loop variable a closure captures, where `let` would create a binding per iteration. Choosing `const` is left to [prefer-const](./prefer-const.md).

Reimplements [ESLint's `no-var`](https://eslint.org/docs/latest/rules/no-var).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
var count = 0
count += 1

function find(items: string[]): number {
  for (var index = 0; index < items.length; index++) {
    if (items[index] === 'x') break
  }
  return index
}
```

### ✅ Correct

```ts
let count = 0
count += 1

declare global {
  var registry: string[]
}
```

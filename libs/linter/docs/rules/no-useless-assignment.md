# no-useless-assignment

Forbid assigning a value to a variable that nothing reads before it is overwritten or goes out of scope.

## Rule Details

A value that is written and then overwritten, or written just before the function ends, does nothing. It is often a bug: the read that should have used it reads a different variable, or a branch that should have returned the value does not. The rule follows the code paths of each function and reports a write, an initialiser included, whose value no read can see before the next write on every path.

Variables that are never read at all are left to [typescript/no-unused-vars](./typescript/no-unused-vars.md). A variable read from a nested function, or exported from the module, is not checked, since such a read may happen at any time. The rule does not fix.

Reimplements [ESLint's `no-useless-assignment`](https://eslint.org/docs/latest/rules/no-useless-assignment).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function label(count: number): string {
  let text = 'none'
  text = count > 1 ? 'many' : 'one'
  return text
}

function total(items: number[]): number {
  let sum = 0
  for (const item of items) sum += item
  sum = 0
  return items.length
}
```

### ✅ Correct

```ts
function label(count: number): string {
  let text = 'none'
  if (count > 0) text = count > 1 ? 'many' : 'one'
  return text
}
```

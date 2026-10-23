# no-debugger

Forbid [`debugger`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger) statements.

## Rule Details

A [`debugger`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger) statement pauses execution whenever developer tools are open, which is useful while debugging and wrong in committed code. The rule reports every [`debugger`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger) statement. It does not fix: removing a statement belongs to the author, and a breakpoint in the editor does the same job without a change to the source.

Reimplements [ESLint's `no-debugger`](https://eslint.org/docs/latest/rules/no-debugger).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function total(items: number[]): number {
  debugger
  return items.reduce((sum, item) => sum + item, 0)
}
```

### ✅ Correct

```ts
function total(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0)
}
```

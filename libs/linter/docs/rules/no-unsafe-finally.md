# no-unsafe-finally

Forbid `return`, `throw`, `break` and `continue` that jump out of a `finally` block.

## Rule Details

A `finally` block runs after the `try` and `catch` have decided how the statement ends. A jump that leaves the `finally` overrides that decision: a `return` there replaces the value the `try` returned and silently discards an exception being thrown. The rule reports a `return` or `throw` inside a `finally` block, and a `break` or `continue` whose target lies outside it. Jumps that stay inside the block, such as a `break` out of a loop or `switch` written within the `finally`, or a `return` in a function declared inside it, are not reported. The rule does not fix.

Reimplements [ESLint's `no-unsafe-finally`](https://eslint.org/docs/latest/rules/no-unsafe-finally).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function load(): string {
  try {
    return read()
  } finally {
    return 'fallback'
  }
}
```

### ✅ Correct

```ts
function load(): string {
  try {
    return read()
  } finally {
    for (const handle of handles) {
      if (handle.closed) break
      handle.close()
    }
  }
}
```

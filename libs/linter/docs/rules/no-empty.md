# no-empty

Forbid empty block statements and empty `switch` statements.

## Rule Details

An empty block is usually unfinished code, or an error silently swallowed by an empty `catch`. The rule reports a block statement with no statements, such as the body of an `if`, a loop, a `try` or a `catch`, and a `switch` with no cases. A comment inside the braces says the emptiness is intended and the block is left alone. Function bodies are never reported. The rule does not fix.

Reimplements [ESLint's `no-empty`](https://eslint.org/docs/latest/rules/no-empty).

## Options

| Option                        | Type      | Default | Meaning                                |
| ----------------------------- | --------- | ------- | -------------------------------------- |
| [`allowEmptyCatch`](#options) | `boolean` | `false` | Whether an empty `catch` block passes. |

## Examples

### ❌ Incorrect

```ts
if (ready) {
}

try {
  run()
} catch (error) {}

switch (kind) {
}
```

### ✅ Correct

```ts
if (ready) {
  // nothing to do until the next tick
}

try {
  run()
} catch (error) {
  report(error)
}

function noop(): void {}
```

### ✅ Correct, with { "allowEmptyCatch": true }

<!-- options: {"allowEmptyCatch": true} -->

```ts
try {
  run()
} catch {}
```

## Limitations

The original offers a suggestion that adds an "empty" comment to the block; this rule reports without one.

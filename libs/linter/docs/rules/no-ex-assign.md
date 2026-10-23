# no-ex-assign

Forbid assigning to the parameter of a `catch` clause.

## Rule Details

The `catch` parameter holds the exception that was thrown. Assigning to it replaces that exception, so whatever handles or rethrows it afterwards works with something else, and the original error is lost. The rule reports every write to a binding declared by a `catch` parameter, destructured ones included. To transform the error, store the result in a new variable. The rule does not fix.

Reimplements [ESLint's `no-ex-assign`](https://eslint.org/docs/latest/rules/no-ex-assign).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
try {
  run()
} catch (error) {
  error = new Error('run failed')
  throw error
}
```

### ✅ Correct

```ts
try {
  run()
} catch (error) {
  throw new Error('run failed', { cause: error })
}
```

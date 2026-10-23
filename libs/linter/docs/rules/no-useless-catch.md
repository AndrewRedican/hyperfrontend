# no-useless-catch

Forbid `catch` clauses that only rethrow the error they caught.

## Rule Details

A `catch (error) { throw error }` changes nothing: the error propagates exactly as it would without the clause. The rule reports a `catch` clause whose first statement rethrows its own parameter. Without a `finally`, the whole `try` statement is reported, since the `try` itself is then noise; with one, only the `catch` clause is reported, since the `finally` still justifies the `try`. A clause that does anything before rethrowing, such as logging or wrapping the error, is not reported. The rule does not fix.

Reimplements [ESLint's `no-useless-catch`](https://eslint.org/docs/latest/rules/no-useless-catch).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
try {
  run()
} catch (error) {
  throw error
}

try {
  run()
} catch (error) {
  throw error
} finally {
  cleanUp()
}
```

### ✅ Correct

```ts
try {
  run()
} catch (error) {
  log(error)
  throw error
}

try {
  run()
} finally {
  cleanUp()
}
```

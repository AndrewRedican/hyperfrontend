# no-async-promise-executor

Forbid an async function as the executor of `new Promise(...)`.

## Rule Details

An error thrown inside an async executor rejects the executor's own promise, not the one being constructed, so it is lost and the new promise never settles. An async executor also usually means the code awaits something it could have returned directly. The rule reports the `async` keyword of a function or arrow passed as the first argument to `new Promise(...)`. The rule does not fix.

Reimplements [ESLint's `no-async-promise-executor`](https://eslint.org/docs/latest/rules/no-async-promise-executor).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const result = new Promise(async (resolve) => {
  resolve(await load())
})
```

### ✅ Correct

```ts
const result = new Promise((resolve, reject) => {
  load().then(resolve, reject)
})

const direct = load()
```

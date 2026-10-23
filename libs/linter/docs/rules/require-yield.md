# require-yield

Require generator functions with a body to contain `yield`.

## Rule Details

A generator that never yields produces an iterator that finishes at once, with its return value as the only result. That is rarely the intent: either a `yield` is missing, or the function was meant to be an ordinary one. The rule reports a generator function declaration or expression, generator methods included, whose body has statements but no `yield`. An empty generator, `function* () {}`, is allowed, since it is a deliberate empty iterator. The rule does not fix.

Reimplements [ESLint's `require-yield`](https://eslint.org/docs/latest/rules/require-yield).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
function* ids() {
  return [1, 2, 3]
}
```

### ✅ Correct

```ts
function* ids() {
  yield 1
  yield 2
}

function* none() {}
```

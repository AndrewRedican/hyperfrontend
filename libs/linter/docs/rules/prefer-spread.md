# prefer-spread

Require spread syntax instead of `.apply()` to call a function with an array of arguments.

## Rule Details

`fn.apply(null, args)` was the way to call a function with an array of arguments before spread syntax existed. `fn(...args)` says the same thing directly and does not make the reader check the `this` argument. The rule reports a two-argument `.apply(...)` call that spread can replace exactly: one whose `this` argument is `null`, `undefined` or `void 0` for a plain function, or the same object the method is read from, as in `math.max.apply(math, values)`. Calls whose argument list is an array literal, and calls that pass a different `this`, are left alone. The rule does not fix.

Reimplements [ESLint's `prefer-spread`](https://eslint.org/docs/latest/rules/prefer-spread).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const largest = max.apply(null, values)
const joined = parts.push.apply(parts, extra)
```

### ✅ Correct

```ts
const largest = max(...values)
parts.push(...extra)
const bound = handler.apply(context, values)
```

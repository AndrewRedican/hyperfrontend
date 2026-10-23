# no-sparse-arrays

Forbid holes in array literals, such as `[1, , 3]`.

## Rule Details

Two commas with nothing between them leave a hole in the array: the index exists in the length but holds no element, and array methods treat it differently from `undefined`. A hole is easy to miss and is almost always a typo. The rule reports the comma that ends each hole of an array literal; a single trailing comma, as in `[1, 2,]`, is not a hole. Destructuring patterns, where an empty slot skips a value, are not array literals and are not read. The rule does not fix.

Reimplements [ESLint's `no-sparse-arrays`](https://eslint.org/docs/latest/rules/no-sparse-arrays).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const levels = ['low', , 'high']
const leading = [, 1]
```

### ✅ Correct

```ts
const levels = ['low', undefined, 'high']
const trailing = [1, 2]
const [, second] = levels
```

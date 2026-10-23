# jsdoc/require-next-type

Require a type on every `@next` tag.

## Rule Details

The `@next` tag documents the values a caller sends into a generator through `next()`, and without a type it says nothing about them. This rule reports each JSDoc block in the file that holds a `@next` tag written without a type in braces, once per block. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-next-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-next-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * Accumulates the numbers sent in.
 *
 * @next The number to add
 */
export function* total(): Generator<number, void, number> {
  let sum = 0
  while (true) sum += yield sum
}
```

### ✅ Correct

```ts
/**
 * Accumulates the numbers sent in.
 *
 * @next {number} The number to add
 */
export function* total(): Generator<number, void, number> {
  let sum = 0
  while (true) sum += yield sum
}
```

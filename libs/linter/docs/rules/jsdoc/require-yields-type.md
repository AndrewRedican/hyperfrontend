# jsdoc/require-yields-type

Require a type on every `@yields` tag.

## Rule Details

A `@yields` tag without a type says that a generator produces values but not what they are. This rule reports each JSDoc block in the file that holds a `@yields` or `@yield` tag written without a type in braces, once per block. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-yields-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * Counts upwards from zero.
 *
 * @yields The next number
 */
export function* count(): Generator<number> {
  for (let n = 0; ; n += 1) yield n
}
```

### ✅ Correct

```ts
/**
 * Counts upwards from zero.
 *
 * @yields {number} The next number
 */
export function* count(): Generator<number> {
  for (let n = 0; ; n += 1) yield n
}
```

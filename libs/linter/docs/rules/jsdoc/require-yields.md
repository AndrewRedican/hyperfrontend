# jsdoc/require-yields

Require a `@yields` tag, once, in the JSDoc of a generator that yields a value.

## Rule Details

When a documented generator produces values, the reader needs to know what they are. On functions and methods that have a JSDoc block, this rule reports a block with no `@yields` tag when the function is a generator that yields a value, or when the block is marked `@generator`. It also reports a block with more than one `@yields` tag. Constructors are skipped, and so are blocks tagged `@abstract`, `@virtual`, `@class`, `@constructor`, `@type`, `@interface`, `@ignore`, `@override`, `@implements` or `@inheritDoc`, and members of a class whose block carries one of `@ignore`, `@override` or `@implements`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-yields`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields.md#options), which require `@next` tags, force the tag on generators that yield nothing, add node types and exempt more tags, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/**
 * Counts upwards from zero.
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
 * @yields The next number
 */
export function* count(): Generator<number> {
  for (let n = 0; ; n += 1) yield n
}
```

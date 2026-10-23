# jsdoc/require-yields-check

Require a function documented with `@yields` to yield a value.

## Rule Details

A `@yields` tag promises values to whoever iterates the generator, so a function that yields nothing contradicts its docs. On documented functions and methods, this rule reports a block with more than one `@yields` tag, and a block whose single `@yields` tag stands over a function that yields no value, unless the tag's type admits `undefined` or `void`. A `{never}` tag is reported when the function does yield a value. Constructors, blocks marked `@abstract`, `@virtual`, `@class`, `@constructor` or `@interface`, and members of a class documented as an `@interface` are skipped. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-yields-check`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields-check.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-yields-check.md#options), which limit the check to generators, add node types and check `@next` tags as well, are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Walks the list.
 *
 * @yields Each item
 */
export function* walk(items: string[]): Generator<string> {
  return items.length
}
```

### ✅ Correct

```ts
/**
 * Walks the list.
 *
 * @yields Each item
 */
export function* walk(items: string[]): Generator<string> {
  yield* items
}
```

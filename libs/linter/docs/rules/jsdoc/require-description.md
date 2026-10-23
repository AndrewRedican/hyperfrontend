# jsdoc/require-description

Require a function's JSDoc block to open with a plain description.

## Rule Details

The description is what a reader and an editor tooltip show first, so a block made of tags alone leaves the function unexplained. This rule reports the JSDoc block of a function, method, getter, setter or constructor that has no description before its tags. When the text sits in a `@desc` or `@description` tag instead, the message says to drop the tag or add text above it. A block tagged `@ignore`, `@override`, `@implements` or `@inheritDoc`, or a member of a class whose block carries one of the first three, is exempt. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-description`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-description.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-description.md#options), which choose the description style, add node types to check, exempt more tags and skip constructors, getters or setters, are not read: plain descriptions are required on every kind of function.

## Examples

### ❌ Incorrect

```ts
/**
 * @param path - Where the file is
 * @returns Its contents
 */
export function read(path: string): string {
  return path
}
```

### ✅ Correct

```ts
/**
 * Reads a text file.
 *
 * @param path - Where the file is
 * @returns Its contents
 */
export function read(path: string): string {
  return path
}
```

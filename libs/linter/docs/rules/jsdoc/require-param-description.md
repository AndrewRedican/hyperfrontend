# jsdoc/require-param-description

Require every `@param` tag in a function's JSDoc to have a description.

## Rule Details

A `@param` tag that gives only a name tells the reader nothing the signature did not. On the JSDoc blocks of functions and methods, this rule reports each `@param` tag whose description is empty. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-param-description`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-description.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-description.md#options), which add node types to check and set a default description for destructured roots, are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Resizes an image.
 *
 * @param width
 */
export function resize(width: number): number {
  return width
}
```

### ✅ Correct

```ts
/**
 * Resizes an image.
 *
 * @param width - The new width in pixels
 */
export function resize(width: number): number {
  return width
}
```

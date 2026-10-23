# jsdoc/no-types

Forbid types in the `@param` and `@returns` tags of TypeScript functions.

## Rule Details

In TypeScript the signature already carries the types, so a type in braces in the JSDoc repeats it and can contradict it. This rule reports a type on a `@param`, `@arg`, `@argument`, `@returns` or `@return` tag in the JSDoc of a function, method or method signature, and a type on a `@property` or `@prop` tag in the JSDoc of a class. The fix removes the type and the space after the tag, across every line the type spans.

Reimplements [eslint-plugin-jsdoc's `no-types`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-types.md).

## Options

This rule has no options. The original's [`contexts`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-types.md#options) option, which adds node types to check, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Adds two numbers.
 *
 * @param {number} a - The first
 * @param {number} b - The second
 * @returns {number} The sum
 */
export function add(a: number, b: number): number {
  return a + b
}
```

### ✅ Correct

```ts
/**
 * Adds two numbers.
 *
 * @param a - The first
 * @param b - The second
 * @returns The sum
 */
export function add(a: number, b: number): number {
  return a + b
}
```

# jsdoc/require-returns-check

Require a function documented with `@returns` to return a value.

## Rule Details

A `@returns` tag promises callers a value, so a function that returns nothing contradicts its docs. On documented functions and methods, this rule reports a block with more than one `@returns` tag. With a single tag it reports the block when the function never returns a value, for an untyped tag, or when some path returns without a value, for a typed one. A type that admits `undefined` or `void`, such as `{string | undefined}`, an assertion type such as `{asserts value}`, and generator functions are exempt. A `{never}` tag is reported when the function does return a value. Async functions are skipped, since their value is the promise's, and so are constructors, blocks marked `@abstract`, `@virtual`, `@class`, `@constructor` or `@interface`, and members of a class documented as an `@interface`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-returns-check`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-check.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-check.md#options), which stop exempting async functions and generators and report a missing return for undefined types, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/**
 * Logs a message.
 *
 * @param message - What to log
 * @returns The message
 */
export function log(message: string): void {
  console.log(message)
}
```

### ✅ Correct

```ts
/**
 * Logs a message.
 *
 * @param message - What to log
 * @returns The message
 */
export function log(message: string): string {
  console.log(message)
  return message
}
```

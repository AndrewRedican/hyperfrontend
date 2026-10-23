# jsdoc/require-throws-type

Require a type on every `@throws` tag.

## Rule Details

A caller deciding what to catch needs to know what is thrown, and a `@throws` tag without a type only says that something might be. This rule reports each JSDoc block in the file that holds a `@throws` or `@exception` tag written without a type in braces, once per block. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-throws-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-throws-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * Parses a port number.
 *
 * @param text - The digits
 * @returns The port
 * @throws When the text is not a valid port
 */
export function port(text: string): number {
  return Number(text)
}
```

### ✅ Correct

```ts
/**
 * Parses a port number.
 *
 * @param text - The digits
 * @returns The port
 * @throws {RangeError} When the text is not a valid port
 */
export function port(text: string): number {
  return Number(text)
}
```

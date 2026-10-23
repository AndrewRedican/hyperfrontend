# jsdoc/require-property

Require a `@typedef` or `@namespace` of a plain object type to list its properties.

## Rule Details

A `@typedef {object}` without `@property` tags declares an object type and says nothing about its shape. In every JSDoc block of the file, this rule reports a `@typedef` or `@namespace` whose type is `object`, `Object` or PlainObject when the block holds no `@property` tag. The fix adds an empty `@property` line after the block's last tag, to be filled in.

Reimplements [eslint-plugin-jsdoc's `require-property`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-property.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 */
```

### ✅ Correct

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string} host - The host name
 * @property {number} port - The port
 */

/**
 * A port number.
 *
 * @typedef {number} Port
 */
```

# jsdoc/require-property-description

Require every `@property` tag to have a description.

## Rule Details

A `@property` tag that gives only a name and type documents the shape but not the meaning of the property. In every JSDoc block of the file, this rule reports each `@property` tag whose description is empty. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-property-description`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-property-description.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string} host
 */
```

### ✅ Correct

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string} host - The host name, without a port
 */
```

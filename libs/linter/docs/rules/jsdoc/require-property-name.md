# jsdoc/require-property-name

Require every `@property` tag to name its property.

## Rule Details

A `@property` tag without a name cannot be matched to a member, so documentation tools drop it. In every JSDoc block of the file, this rule reports each `@property` tag that has no name, whether it is bare or carries only a type such as `@property {string}`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-property-name`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-property-name.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string}
 */
```

### ✅ Correct

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string} host - The host name
 */
```

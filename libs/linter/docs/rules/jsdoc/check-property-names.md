# jsdoc/check-property-names

Require each `@property` of a JSDoc block to be named once, with dotted paths after their root.

## Rule Details

A `@property` tag documents a member of a `@typedef` or of a documented object. This rule reports a property name that appears twice for the same type definition, a block holding several `@typedef` tags being checked one definition at a time. When there are no duplicates, it reports a dotted path such as `@property options.port` whose root property is not documented. Every JSDoc block in the file is read. It does not fix.

Reimplements [eslint-plugin-jsdoc's `check-property-names`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-property-names.md).

## Options

This rule has no options. The original's [`enableFixer`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-property-names.md#options) option, which removes duplicates, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * A server address.
 *
 * @typedef {object} Address
 * @property {string} host - The host
 * @property {string} host - The host name
 */

/**
 * A connection.
 *
 * @typedef {object} Connection
 * @property {number} options.port - The port
 */
```

### ✅ Correct

```ts
/**
 * A connection.
 *
 * @typedef {object} Connection
 * @property {object} options - The settings
 * @property {number} options.port - The port
 */
```

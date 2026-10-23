# jsdoc/check-values

Require JSDoc tags that take a value to carry a valid one.

## Rule Details

Several JSDoc tags are only useful with a well-formed value. In every JSDoc block, this rule reports a `@version` or `@since` that is missing or is not a semantic version, a `@kind` that is missing or is not one of JSDoc's kinds (class, constant, event, external, file, function, member, mixin, module, namespace, typedef), a `@license` that is missing or is not a valid SPDX expression, an empty `@author` or `@variation`, and an `@import` whose text is not an import declaration with a quoted module. It does not fix.

Reimplements [eslint-plugin-jsdoc's `check-values`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-values.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-values.md#options), which restrict authors and licenses, set a license pattern and require numeric variations, are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * The cache.
 *
 * @since next
 * @license MIT-ish
 * @kind thing
 */
export const cache = new Map<string, string>()
```

### ✅ Correct

```ts
/**
 * The cache.
 *
 * @since 1.2.0
 * @license MIT OR Apache-2.0
 * @kind constant
 */
export const cache = new Map<string, string>()
```

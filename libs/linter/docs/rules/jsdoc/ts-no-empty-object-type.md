# jsdoc/ts-no-empty-object-type

Forbid the empty object type `{}` in the types of JSDoc tags.

## Rule Details

The type `{}` admits every value except `null` and `undefined`, literals included, which is rarely what a block means: `object` says "any object" and `unknown` says "any value". This rule reads the type of every typed tag in every JSDoc block and reports each empty object type it contains, at any depth, such as `{Array<{}>}`. An object type with members passes. It does not fix.

Reimplements [eslint-plugin-jsdoc's `ts-no-empty-object-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/ts-no-empty-object-type.md), the JSDoc counterpart of [`typescript/no-empty-object-type`](../typescript/no-empty-object-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * The cached entries.
 *
 * @type {Array<{}>}
 */
export const entries = []
```

### ✅ Correct

```ts
/**
 * The cached entries.
 *
 * @type {Array<{key: string}>}
 */
export const entries = []
```

# jsdoc/reject-any-type

Forbid `any` and `*` in the types of JSDoc tags.

## Rule Details

A JSDoc type of `{any}` or `{*}` says only that the value could be anything, which documents nothing. This rule reads the type of every typed tag in every JSDoc block and reports each `any` or `*` it contains, at any depth, such as `{Array<any>}`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `reject-any-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/reject-any-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * The parsed payload.
 *
 * @type {Array<any>}
 */
export const payload = []
```

### ✅ Correct

```ts
/**
 * The parsed payload.
 *
 * @type {Array<string>}
 */
export const payload = []
```

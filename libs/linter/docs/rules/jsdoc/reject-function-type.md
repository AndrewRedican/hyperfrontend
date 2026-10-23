# jsdoc/reject-function-type

Forbid `Function` in the types of JSDoc tags.

## Rule Details

`{Function}` accepts any callable and says nothing about its parameters or result. This rule reads the type of every typed tag in every JSDoc block and reports each `Function` it contains, at any depth, such as `{Array<Function>}`. A function type with its signature, `{(value: string) => void}`, passes. It does not fix.

Reimplements [eslint-plugin-jsdoc's `reject-function-type`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/reject-function-type.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * The registered listeners.
 *
 * @type {Array<Function>}
 */
export const listeners = []
```

### ✅ Correct

```ts
/**
 * The registered listeners.
 *
 * @type {Array<(event: string) => void>}
 */
export const listeners = []
```

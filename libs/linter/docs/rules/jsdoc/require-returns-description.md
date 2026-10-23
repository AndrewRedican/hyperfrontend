# jsdoc/require-returns-description

Require every `@returns` tag in a function's JSDoc to have a description.

## Rule Details

A `@returns` tag with no description says that something comes back but not what it means. On the JSDoc blocks of functions and methods, this rule reports each `@returns` tag whose description is empty, unless its type says nothing comes back: `{void}`, `{undefined}`, `{Promise<void>}` or `{Promise<undefined>}`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-returns-description`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-description.md).

## Options

This rule has no options. The original's [`contexts`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns-description.md#options) option, which adds node types to check, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Counts the items.
 *
 * @returns
 */
export function count(): number {
  return 0
}
```

### ✅ Correct

```ts
/**
 * Counts the items.
 *
 * @returns How many items the list holds
 */
export function count(): number {
  return 0
}

/**
 * Clears the items.
 *
 * @returns {void}
 */
export function clear(): void {
  return undefined
}
```

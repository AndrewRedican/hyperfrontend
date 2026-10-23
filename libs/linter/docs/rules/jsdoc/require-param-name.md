# jsdoc/require-param-name

Require every `@param` tag in a function's JSDoc to name its parameter.

## Rule Details

A `@param` tag without a name cannot be matched to a parameter, so tools drop it or attach it to the wrong one. On the JSDoc blocks of functions and methods, this rule reports each `@param` tag that has no name, whether the tag is bare or carries only a type such as `@param {string}`. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-param-name`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-name.md).

## Options

This rule has no options. The original's [`contexts`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param-name.md#options) option, which adds node types to check, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Greets someone.
 *
 * @param {string}
 */
export function greet(name: string): string {
  return name
}
```

### ✅ Correct

```ts
/**
 * Greets someone.
 *
 * @param {string} name - Who to greet
 */
export function greet(name: string): string {
  return name
}
```

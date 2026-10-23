# jsdoc/require-returns

Require a `@returns` tag, once, in the JSDoc of a function that returns a value.

## Rule Details

When a documented function gives back a value, the reader needs to know what it is. On functions and methods that have a JSDoc block, this rule reports a block with no `@returns` tag when the function returns a value on some path, or has an expression body, or, for a declared signature, names a return type other than `void`, `undefined` or `never`. A returned `new Promise` counts only when its executor resolves a value. It also reports a block with more than one `@returns` tag. Constructors are skipped, and so are blocks tagged `@abstract`, `@virtual`, `@class`, `@constructor`, `@type`, `@interface`, `@ignore`, `@override`, `@implements` or `@inheritDoc`, and members of a class whose block carries one of `@ignore`, `@override` or `@implements`. Getters and setters are checked. It does not fix.

Reimplements [eslint-plugin-jsdoc's `require-returns`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-returns.md#options), which force the tag on async functions, check constructors or skip getters, add node types and exempt more tags, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/**
 * Reads the setting.
 *
 * @param key - The setting's name
 */
export function read(key: string): string {
  return key
}
```

### ✅ Correct

```ts
/**
 * Reads the setting.
 *
 * @param key - The setting's name
 * @returns Its value
 */
export function read(key: string): string {
  return key
}
```

# jsdoc/no-defaults

Forbid default values in a function's JSDoc, where they belong in the signature.

## Rule Details

A default written in the docs, as `@param [retries=3]` or `@default 3`, duplicates the default in the signature and drifts from it. On the JSDoc blocks of functions, this rule reports a `@param`, `@arg` or `@argument` whose bracketed name carries `=value`, and a `@default` or `@defaultvalue` tag with a value. The fix drops the value: the parameter keeps its brackets, `[retries]`, and the default tag is left bare.

Reimplements [eslint-plugin-jsdoc's `no-defaults`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-defaults.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/no-defaults.md#options), which add node types to check and also forbid the optional brackets, are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Fetches a resource.
 *
 * @param url - The address
 * @param [retries=3] - How often to try again
 */
export function load(url: string, retries = 3): string {
  return url.repeat(retries)
}
```

### ✅ Correct

```ts
/**
 * Fetches a resource.
 *
 * @param url - The address
 * @param [retries] - How often to try again
 */
export function load(url: string, retries = 3): string {
  return url.repeat(retries)
}
```

# jsdoc/check-param-names

Require the `@param` tags of a function's JSDoc to name its parameters, in order.

## Rule Details

A `@param` tag that names the wrong parameter documents something the function does not have, and it is the first thing to go stale after a rename. On functions, methods and method signatures, this rule reports a `@param` name that differs from the parameter at its position, a tag past the last parameter, and a duplicate tag. For a destructured parameter documented with no type or a plain object type, it also reports a property left out of the dotted `@param root.property` tags, a documented property the pattern does not have, and a dotted path whose root is not documented. A `this` parameter may be left undocumented. It stops at the first problem in a block and does not fix.

Reimplements [eslint-plugin-jsdoc's `check-param-names`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-param-names.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-param-names.md#options), which allow extra trailing tags, turn off the destructuring and missing-tag checks, choose which types skip property checks and enable a fixer, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/**
 * Moves a point.
 *
 * @param x - The horizontal offset
 * @param z - The vertical offset
 */
export function move(x: number, y: number): void {
  return undefined
}

/**
 * Opens a connection.
 *
 * @param options - The settings
 * @param options.host - The host
 */
export function open({ host, port }: Settings): void {
  return undefined
}
```

### ✅ Correct

```ts
/**
 * Opens a connection.
 *
 * @param options - The settings
 * @param options.host - The host
 * @param options.port - The port
 */
export function open({ host, port }: Settings): void {
  return undefined
}
```

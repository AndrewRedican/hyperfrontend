# jsdoc/require-param

Require a `@param` tag for every parameter of a documented function.

## Rule Details

A JSDoc block that documents some parameters and skips others leaves the reader guessing about the rest. On functions, methods and constructors that have a JSDoc block, this rule reports each parameter without a `@param` tag. A destructured parameter needs a tag for its root and one for each property, as `@param options.port`; an unnamed root is called root0, root1 and so on, unless a tag at its position already names it. A property under a documented path whose type is neither absent nor a plain object is not required. A `this` parameter is never required.

Getters and setters are not checked, and neither is a block tagged `@type`, `@ignore`, `@override`, `@implements` or `@inheritDoc`, or a member of a class whose block carries one of the middle three. The fix inserts the missing tags in parameter order, before the tag of the next documented parameter or after the last `@param`, typed `{...any}` for a rest parameter. A function without a JSDoc block is left to [`require-jsdoc`](./require-jsdoc.md).

Reimplements [eslint-plugin-jsdoc's `require-param`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-param.md#options), which control the destructuring checks, the checked member kinds, the unnamed root name, the exempting tags, the node types checked and the fixers, are not read: the behaviour is fixed to the original's defaults.

## Examples

### ❌ Incorrect

```ts
/**
 * Connects to a server.
 *
 * @param host - The host name
 */
export function connect(host: string, { port, secure }: Options): void {
  return undefined
}
```

### ✅ Correct

```ts
/**
 * Connects to a server.
 *
 * @param host - The host name
 * @param root0 - The connection settings
 * @param root0.port - The port
 * @param root0.secure - Whether to use TLS
 */
export function connect(host: string, { port, secure }: Options): void {
  return undefined
}
```

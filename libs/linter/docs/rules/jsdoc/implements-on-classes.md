# jsdoc/implements-on-classes

Forbid `@implements` on a function that is not a class or constructor.

## Rule Details

`@implements` says that a class fulfils an interface, so on a plain function it documents nothing true. This rule reports each `@implements` tag in the JSDoc block of a function, method or arrow function, unless the function is a class constructor or its block also carries `@class` or `@constructor`. Blocks on classes are not checked, since that is where the tag belongs. It does not fix.

Reimplements [eslint-plugin-jsdoc's `implements-on-classes`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/implements-on-classes.md).

## Options

This rule has no options. The original's [`contexts`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/implements-on-classes.md#options) option, which adds node types to check, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Creates a logger.
 *
 * @implements {Logger}
 */
export function createLogger(): Logger {
  return console
}
```

### ✅ Correct

```ts
/**
 * Writes to the console.
 *
 * @implements {Logger}
 */
export class ConsoleLogger implements Logger {
  log(message: string): void {
    console.log(message)
  }
}

/**
 * Creates a logger.
 *
 * @class
 * @implements {Logger}
 */
export function LegacyLogger(this: Logger): void {
  return undefined
}
```

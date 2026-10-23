# no-mixed-type-export

Forbid an export list that mixes inline `type` specifiers with value specifiers.

## Rule Details

An export list that names types and values together hides which names survive compilation: the types are erased, the values stay. Keeping them in an `export type` statement and a plain export makes the split visible and gives tools that elide types one statement to drop. The rule reports an export list, a re-export or a local one, that holds both specifiers marked `type` and unmarked ones. The fix splits it into an `export type { … }` and an `export { … }` of the same source, keeping each specifier's alias.

A list whose specifiers are all marked `type`, or none of them, is not reported.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
export { type User, createUser } from './module'

export { type Config, type Options, initConfig as init } from './config'
```

### ✅ Correct

```ts
export type { User } from './module'
export { createUser } from './module'

export type { Config, Options } from './config'
export { initConfig as init } from './config'
```

## When Not To Use It

When a project prefers the brevity of inline type specifiers. The same split for imports is [no-mixed-type-import](./no-mixed-type-import.md).

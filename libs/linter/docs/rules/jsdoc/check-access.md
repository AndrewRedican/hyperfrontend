# jsdoc/check-access

Require a JSDoc block's access control to name a valid level, once.

## Rule Details

Access control in JSDoc is written either as `@access <level>` or as one of the shorthand tags `@package`, `@private`, `@protected` and `@public`. This rule reports an `@access` tag whose level is not one of package, private, protected or public, a block that combines `@access` with a shorthand tag, and a block carrying more than one access-control tag. Every JSDoc block in the file is read, whether or not it documents a declaration. It does not fix.

Reimplements [eslint-plugin-jsdoc's `check-access`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-access.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * Clears the cache.
 *
 * @access internal
 */
export function clear(): void {
  return undefined
}

/**
 * Resets the store.
 *
 * @access private
 * @public
 */
export function reset(): void {
  return undefined
}
```

### ✅ Correct

```ts
/**
 * Clears the cache.
 *
 * @access package
 */
export function clear(): void {
  return undefined
}
```

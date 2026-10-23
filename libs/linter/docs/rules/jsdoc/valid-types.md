# jsdoc/valid-types

Require the types, names and namepaths in JSDoc tags to be well formed and to sit on tags that take them.

## Rule Details

A type that does not parse, or a name on a tag that takes none, is silently misread by documentation tools and editors. In every JSDoc block of the file, this rule reports, stopping at the first problem of each tag:

- a malformed bracketed name: unpaired brackets, an empty name, an empty default, or a default containing an unquoted `=`
- a name or a bracketed type on a tag that takes none, such as `@private {string}`
- a missing name, type, or either one where the tag needs it, such as `@fires` without an event name or `@type` without a type
- a type that does not parse as a TypeScript-flavoured JSDoc type, such as `{Array<string}`
- a namepath with a stray character on tags such as `@memberof`, `@module`, `@property` or `@template`, and a `@borrows` without an `as` target
- an inline tag such as `{@link}` with no content, in a description or a tag's text

Missing `@param` and `@property` names are left to [`jsdoc/require-param-name`](./require-param-name.md) and [`jsdoc/require-property-name`](./require-property-name.md). It does not fix.

Reimplements [eslint-plugin-jsdoc's `valid-types`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/valid-types.md).

## Options

This rule has no options. The original's [`allowEmptyNamepaths`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/valid-types.md#options) option is not read: empty namepaths are reported where a tag needs one.

## Examples

### ❌ Incorrect

```ts
/**
 * Lists the names.
 *
 * @param {Array<string} names - The names
 * @returns The joined names
 */
export function list(names: string[]): string {
  return names.join(', ')
}
```

```ts
/**
 * The default port.
 *
 * @private {number}
 */
export const port = 8080
```

```ts
/**
 * See {@link} for details.
 */
export const docs = true
```

### ✅ Correct

```ts
/**
 * Lists the names, see {@link join}.
 *
 * @param {Array<string>} names - The names
 * @returns The joined names
 */
export function list(names: string[]): string {
  return names.join(', ')
}
```

## Limitations

The original reads tags by its mode setting; this rule always reads them in TypeScript mode, so tag structures that only the closure or plain JSDoc modes allow are reported.

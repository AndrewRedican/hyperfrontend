# jsdoc/informative-docs

Forbid JSDoc descriptions that only repeat the name of what they document.

## Rule Details

"The user id" on a property called userId tells the reader nothing the code did not. This rule splits a block's description and each tag's description into words, camel case included, and removes the names of the documented declaration (and, for a class member, of its class), the tag's own name, and the filler words "a", "an", "i", "in", "of", "s" and "the", with "a" also covering "an" and "our". When no word is left, the description is reported. Empty descriptions pass; other rules require them. It does not fix.

Reimplements [eslint-plugin-jsdoc's `informative-docs`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/informative-docs.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/informative-docs.md#options), which set the aliases, the filler words and the tags to skip, are not read: the defaults apply.

## Examples

### ❌ Incorrect

```ts
/**
 * The user id.
 *
 * @param name - The name
 */
export function userId(name: string): string {
  return name
}
```

### ✅ Correct

```ts
/**
 * Derives the identifier a user signs in with.
 *
 * @param name - The display name, lower-cased before use
 */
export function userId(name: string): string {
  return name
}
```

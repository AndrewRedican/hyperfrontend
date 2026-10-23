# jsdoc/empty-tags

Require JSDoc marker tags, such as `@private` or `@readonly`, to carry no text.

## Rule Details

Some tags only mark a symbol, and text after them is either ignored or misread as a name or type. In every JSDoc block, this rule reports one of `@abstract`, `@async`, `@generator`, `@global`, `@hideconstructor`, `@ignore`, `@inheritDoc`, `@inner`, `@instance`, `@internal`, `@overload`, `@override`, `@package`, `@private`, `@protected`, `@public`, `@readonly` and `@static` followed by a type, a name or a description. The fix clears the text after the tag on its line.

Reimplements [eslint-plugin-jsdoc's `empty-tags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/empty-tags.md).

## Options

This rule has no options. The original's [`tags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/empty-tags.md#options) option, which adds tags to the list, is not read.

## Examples

### ❌ Incorrect

```ts
/**
 * The retry limit.
 *
 * @readonly always three
 */
export const limit = 3
```

### ✅ Correct

```ts
/**
 * The retry limit, always three.
 *
 * @readonly
 */
export const limit = 3
```

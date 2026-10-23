# jsdoc/check-tag-names

Require JSDoc block and inline tags to be known tags, written by their preferred names.

## Rule Details

A misspelt or invented tag is silently ignored by documentation tools. This rule reports a block tag that JSDoc, TypeScript and TypeDoc do not know and the configuration does not define, and an inline tag other than `{@link}`, `{@linkcode}`, `{@linkplain}`, `{@tutorial}`, `{@inheritDoc}`, `{@label}`, `{@include}` and `{@includeCode}`. A synonym, such as `@return` or `@arg`, is reported and the fix renames it to the preferred tag, `@returns` or `@param`.

With the typed option on, tags that the type system makes redundant are reported too: `@type`, `@typedef`, `@property`, `@private` and similar tags everywhere, and tags such as `@function`, `@static` or `@memberof` outside ambient declarations (`declare` and the top level of `.d.ts` files), as well as an unnamed `@template`. The fix removes such a tag, or keeps its description and drops the type and, where the tag is always redundant, the tag name.

Reimplements [eslint-plugin-jsdoc's `check-tag-names`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md).

## Options

| Option                                                                                                        | Type     | Default | Meaning                                       |
| ------------------------------------------------------------------------------------------------------------- | -------- | ------- | --------------------------------------------- |
| [`typed`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#options)       | boolean  | false   | Report tags a type system makes redundant.    |
| [`definedTags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-tag-names.md#options) | string[] | `[]`    | Extra block tag names to accept, without `@`. |

The original's options that turn the fixer off, accept JSX pragma tags and configure the inline tags are not read: fixes are always offered, JSX pragma tags are accepted only when defined, and the inline tag list is fixed.

## Examples

### ❌ Incorrect

```ts
/**
 * Doubles a number.
 *
 * @arg value - The number
 * @return The double
 * @pure
 */
export function double(value: number): number {
  return value * 2
}
```

<!-- options: {"typed": true} -->

```ts
/**
 * A point.
 *
 * @typedef {object} Point
 */
export interface Point {
  x: number
}
```

### ✅ Correct

<!-- options: {"definedTags": ["pure"]} -->

```ts
/**
 * Doubles a number, see {@link triple}.
 *
 * @param value - The number
 * @returns The double
 * @pure
 */
export function double(value: number): number {
  return value * 2
}
```

## Limitations

The original chooses its known tags by the [mode setting](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/settings.md#mode) and renames tags by the [tag name preference setting](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/settings.md#alias-preference). This rule reads neither: it accepts the union of the JSDoc, TypeScript and TypeDoc tags and applies the default preferences.

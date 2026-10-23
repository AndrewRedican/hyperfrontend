# jsdoc/check-types

Require the types in JSDoc tags to spell native types the way TypeScript does.

## Rule Details

A JSDoc type written `{String}` or `{regexp}` names a native type in the wrong case, and tools disagree on what it means. This rule reads the type of every typed tag, such as `@param`, `@returns` or `@type`, in every JSDoc block, and reports a name that spells `undefined`, `null`, `boolean`, `number`, `bigint`, `string`, `symbol`, `Array`, `Function`, `Date` or `RegExp` in another case, and `Object` where `object` is meant. The fix respells the names. It also reports `object` or `Object` given type arguments, such as `Object.<string, number>`, in favour of an index signature, without a fix.

Reimplements [eslint-plugin-jsdoc's `check-types`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-types.md).

## Options

This rule has no options. The [original's options](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/check-types.md#options), which exempt tag contexts, skip defaults and check parent and child types together, are not read.

## Examples

### ❌ Incorrect

```ts
/**
 * Counts the words of a text.
 *
 * @param {String} text - The text
 * @returns {Object.<string, Number>} The counts
 */
export function count(text: string): Record<string, number> {
  return { [text]: 1 }
}
```

### ✅ Correct

```ts
/**
 * Counts the words of a text.
 *
 * @param {string} text - The text
 * @returns {{[word: string]: number}} The counts
 */
export function count(text: string): Record<string, number> {
  return { [text]: 1 }
}
```

## Limitations

The original picks preferred spellings by its mode setting and accepts a preferred types setting. This rule reads neither: the spellings are always those of TypeScript mode.

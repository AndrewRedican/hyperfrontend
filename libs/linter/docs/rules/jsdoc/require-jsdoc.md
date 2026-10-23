# jsdoc/require-jsdoc

Require a JSDoc block on function declarations and on the declarations the options name.

## Rule Details

A missing block leaves a declaration without the description and tags that other JSDoc rules check and that editors show. This rule reports every function declaration that has no JSDoc block, and every declaration in a context the options list. A block on the first overload signature documents the implementation and the other overloads. Constructors, getters and setters are checked unless the options turn them off. The fix inserts an empty block before the declaration, or before its first decorator, at the declaration's indentation. A declaration that two listed contexts both match is reported twice, but fixed once.

Reimplements [eslint-plugin-jsdoc's `require-jsdoc`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md).

## Options

| Option                                                                                                                  | Type                     | Default | Meaning                                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------- | -------------------------------------------------------------------------- |
| [`contexts`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#options)                | context name[]           | `[]`    | Further declarations that need a block, from the list below.               |
| [`checkConstructors`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#options)       | boolean                  | true    | Check constructors.                                                        |
| [`exemptEmptyConstructors`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#options) | boolean                  | false   | Let a constructor go when it has no parameters and returns no value.       |
| [`checkGetters`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#options)            | boolean                  | true    | Check getters.                                                             |
| [`checkSetters`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/require-jsdoc.md#options)            | boolean \| `'no-getter'` | true    | Check setters, or with `'no-getter'` only those without a matching getter. |

The context names are `'exported-function'`, `'exported-default-function'`, `'exported-class'`, `'exported-default-class'`, `'exported-arrow-variable'` and `'exported-function-variable'` (a function assigned to an exported `const`), `'interface'`, `'type-alias'`, `'property-signature'`, `'method-signature'`, `'public-method'` (excluding an implementation that follows an overload signature), `'public-method-signature'`, `'public-property'`, `'public-abstract-method'` and `'public-abstract-property'`. A member is public unless it carries the private modifier or has a `#private` name.

The original's contexts are AST selectors and its `require` map chooses node types; this rule takes the named contexts above instead and always checks function declarations. The original's options for public-only checks, minimum line counts, empty functions and a custom fixer are not read, and its empty-constructor exemption defaults to on where this one defaults to off.

## Examples

### ❌ Incorrect

```ts
function parse(text: string): number {
  return Number(text)
}
```

<!-- options: {"contexts": ["interface"]} -->

```ts
export interface Point {
  x: number
}
```

### ✅ Correct

```ts
/**
 * Reads a number from text.
 *
 * @param text - The digits
 * @returns The number
 */
function parse(text: string): number {
  return Number(text)
}

export const double = (value: number): number => value * 2
```

# no-irregular-whitespace

Forbid whitespace other than spaces, tabs and line breaks outside string literals.

## Rule Details

A no-break space, a zero-width space or a byte-order mark in the middle of a file looks like an ordinary space, or like nothing, in most editors, yet the engine does not always treat it as whitespace, and it can break a token or a diff in ways that are hard to see. Such characters usually arrive by copy and paste. The rule reports every run of them: form feed and vertical tab, U+0085, U+00A0, U+1680, U+180E, U+2000 to U+200B, U+2028, U+2029, U+202F, U+205F, U+3000 and U+FEFF. String literals may hold them on purpose and are skipped unless [`skipStrings`](#options) is false. Comments, template literals and regular expressions are always read. The rule does not fix.

Reimplements [ESLint's `no-irregular-whitespace`](https://eslint.org/docs/latest/rules/no-irregular-whitespace).

## Options

| Option                    | Type      | Default | Meaning                                                     |
| ------------------------- | --------- | ------- | ----------------------------------------------------------- |
| [`skipStrings`](#options) | `boolean` | `true`  | Whether irregular whitespace inside string literals passes. |

The original's [`skipComments`](https://eslint.org/docs/latest/rules/no-irregular-whitespace#options), [`skipRegExps`](https://eslint.org/docs/latest/rules/no-irregular-whitespace#options), [`skipTemplates`](https://eslint.org/docs/latest/rules/no-irregular-whitespace#options) and [`skipJSXText`](https://eslint.org/docs/latest/rules/no-irregular-whitespace#options) options are not read; those places are always checked, the original's default.

## Examples

The examples hold invisible characters: a zero-width space (U+200B) in the comment and a no-break space (U+00A0) in the strings.

### ❌ Incorrect

```ts
// the​ running total
const total = 1
```

### ❌ Incorrect, with { "skipStrings": false }

<!-- options: {"skipStrings": false} -->

```ts
const label = 'a b'
```

### ✅ Correct

```ts
const total = 1
const label = 'a b'
```

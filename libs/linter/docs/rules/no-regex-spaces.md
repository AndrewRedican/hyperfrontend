# no-regex-spaces

Forbid runs of two or more literal spaces in regular expressions.

## Rule Details

A run of spaces in a pattern is hard to count by eye, so `/a   b/` is easy to misread as two or four spaces. A counted quantifier says how many there are. The rule reports the first run of two or more spaces in a regular expression literal, or in the string pattern of a `RegExp(...)` call with literal flags. Spaces inside a character class are left alone, and when a quantifier follows a run, the last space belongs to it and is not counted.

The fix replaces the run with one space and a count, so three spaces become ` {3}`. It is withheld for a `RegExp` string whose source text spells the pattern differently from its value, for example with escapes, where the offsets would not line up.

Reimplements [ESLint's `no-regex-spaces`](https://eslint.org/docs/latest/rules/no-regex-spaces).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const gap = /total:   \d+/
const built = new RegExp('a   b')
```

### ✅ Correct

```ts
const gap = /total: {3}\d+/
const classed = /[   ]/
const quantified = /a +b/
```

# no-control-regex

Forbid control characters (U+0000 to U+001F) in regular expressions.

## Rule Details

Control characters are rarely what a pattern means to match, and a `\x1f` in a pattern is more often a typo or a copied byte than a deliberate test. The rule reports a regular expression literal, or a `RegExp(...)` or `new RegExp(...)` call with a string pattern, that holds a control character written as a `\x` or `\u` escape or as the raw character itself. The readable escapes such as `\t` and `\n` are left alone, and so are control escapes of the form `\cX`. The message lists the characters found. The rule does not fix.

`RegExp` is recognised when it names the global, is reached through `globalThis`, `window`, [`self`](https://developer.mozilla.org/en-US/docs/Web/API/Window/self) or `global`, or is held in a constant.

Reimplements [ESLint's `no-control-regex`](https://eslint.org/docs/latest/rules/no-control-regex).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const unitSeparator = /\x1f/
const nul = new RegExp('\\x00')
```

### ✅ Correct

```ts
const space = /\x20/
const tab = /\t/
const lineFeed = new RegExp('\\cJ')
```

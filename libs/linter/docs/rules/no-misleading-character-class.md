# no-misleading-character-class

Forbid character classes holding characters that are written as one but made of several code points.

## Rule Details

A character class matches one character at a time, so a symbol that is really a sequence does not match as written: the class matches each of its parts on their own. The rule reports a class in a regular expression literal, or in the string pattern of a `RegExp(...)` call, that holds:

- a surrogate pair, such as an emoji, without the `u` or `v` flag;
- a character followed by a combining mark, such as `A` with a combining accent;
- an emoji followed by a skin-tone modifier;
- a flag written as two regional indicator symbols;
- a sequence joined with zero-width joiners, such as a family emoji.

Characters written as escapes are read the same as the characters themselves, and each problem is reported where it stands in the source. The rule does not fix.

Reimplements [ESLint's `no-misleading-character-class`](https://eslint.org/docs/latest/rules/no-misleading-character-class).

## Options

This rule has no options. The original's [`allowEscape`](https://eslint.org/docs/latest/rules/no-misleading-character-class#options) option is not read, so escaped sequences are always reported.

## Examples

### ❌ Incorrect

```ts
const thumb = /^[👍]$/
const toned = /^[👍🏻]$/u
const flag = /^[🇯🇵]$/u
```

### ✅ Correct

```ts
const thumb = /^[👍]$/u
const either = /^(?:👍🏻|👎)$/u
```

## Limitations

The original offers a suggestion that adds the `u` flag to a pattern whose only problem is a surrogate pair; this rule reports without one.

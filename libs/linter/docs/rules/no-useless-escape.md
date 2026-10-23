# no-useless-escape

Forbid backslashes before characters that need no escaping.

## Rule Details

An unnecessary backslash is noise, and it makes the escapes that do matter harder to spot. The rule reports each such backslash:

- in a regular expression literal, before a character the pattern grammar reads the same way bare, with the rules of character classes and of the `v` flag applied, so `/\-/` outside a class and `/[\.]/` are reported while `/\./` and `/[a\-z]/` are not;
- in a string literal, before a character that is not an escape and not the string's own quote;
- in a template literal, and in a TypeScript template literal type, before a character that is not an escape, a backtick, or the `$` that would open a substitution.

Tagged templates are skipped, since the tag sees the raw text, and so are JSX attribute strings. The rule does not fix.

Reimplements [ESLint's `no-useless-escape`](https://eslint.org/docs/latest/rules/no-useless-escape).

## Options

This rule has no options. The original's [`allowRegexCharacters`](https://eslint.org/docs/latest/rules/no-useless-escape#options) option is not read.

## Examples

### ❌ Incorrect

<!-- prettier-ignore -->
```ts
const quote = "it\'s"
const dash = /\-/
const dot = /[\.]/
const template = `\d`
```

### ✅ Correct

<!-- prettier-ignore -->
```ts
const quote = "it's"
const escaped = 'it\'s'
const dot = /\./
const range = /[a\-z]/
const template = `\${literal}`
```

## Limitations

The original offers suggestions that remove the backslash or double it; this rule reports without them. Patterns passed to `RegExp(...)` as strings are read only as strings.

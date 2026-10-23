# no-useless-backreference

Forbid backreferences in regular expressions that can only ever match the empty string.

## Rule Details

A backreference such as `\1` or `\k<name>` matches what its group captured. When the group cannot have matched yet, or its match has been thrown away, the backreference silently matches the empty string, which is never what it was written for. The rule reports a backreference, in a regular expression literal or the string pattern of a `RegExp(...)` call, that refers to:

- the group that contains it, as in `/(a\1)/`;
- a group later in the pattern, as in `/\1(a)/`;
- a group before it while both sit in a lookbehind, which matches right to left;
- a group in another alternative, as in `/(a)|\1b/`;
- a group inside a negative lookahead or lookbehind that the backreference sits outside of.

The message names the group and the reason. The rule does not fix.

Reimplements [ESLint's `no-useless-backreference`](https://eslint.org/docs/latest/rules/no-useless-backreference).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
const nested = /(a\1)/
const forward = /\1(a)/
const alternative = /(a)|\1b/
const negated = /(?!(a))\1/
```

### ✅ Correct

```ts
const repeated = /(a)\1/
const named = /(?<quote>['"]).*\k<quote>/
const behind = /(?<=\1(a))b/
```

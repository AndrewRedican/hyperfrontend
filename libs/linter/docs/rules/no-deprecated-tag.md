# no-deprecated-tag

Forbid the `@deprecated` tag in block comments.

## Rule Details

The rule is for projects that ship breaking changes in a major version and remove the code they replace, rather than keeping it beside a deprecation warning. Deprecated code that stays accumulates, and a tag that says "use the other one" leaves two ways to do one thing. The rule reports the first `@deprecated` tag of every block comment, in any letter case, when the word is followed by whitespace, `*` or the end of the comment. A mention inside backticks or another word, such as `` `@deprecated` `` in prose, passes. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
/**
 * @deprecated Use newFunction instead
 */
export function oldFunction(): void {}
```

### ✅ Correct

```ts
/**
 * Performs the operation. Replaces the previous implementation, removed in
 * the last major version.
 */
export function newFunction(): void {}
```

## When Not To Use It

When a project keeps backwards compatibility across releases, runs long deprecation cycles, or publishes APIs whose users should be warned before something is removed.

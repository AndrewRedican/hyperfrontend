# escape-package-tags

Require references to the configured package scopes in JSDoc descriptions to be wrapped in backticks.

## Rule Details

A JSDoc description that mentions a scoped package leaves an `@` at a word boundary, and every JSDoc parser, TypeDoc included, reads it as the start of a tag. The mention is either swallowed into a bogus tag or cuts off the description that follows it. The rule finds those references for the scopes listed in [`prefixes`](#options) and its fix wraps each in backticks, which is both a valid escape and the right markup for a package name. A leading backslash escape is folded into the fix, so `\@acme/logging` becomes `` `@acme/logging` ``: many renderers that turn backticks into code do not process backslash escapes, and the backslash would show in the published docs.

The whole specifier is measured, scope, name and any sub-path, so `@acme/core/utils` is wrapped as a unit; trailing punctuation is left outside. A reference is reported when it starts a description line or follows whitespace. A description line that opens with a guarded scope is reported rather than read as a tag, since that is exactly the corruption the rule prevents.

The rule leaves alone:

- references already in backticks, or embedded in quotes such as `"@acme/core"`;
- everything from the first genuine block tag onwards, so `@module @acme/core` and the bodies of example tags are untouched;
- fenced code blocks inside the description;
- a prefix that only starts a longer word, such as `@acmeish`.

[eslint-plugin-jsdoc's `escape-inline-tags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/escape-inline-tags.md) covers the general case but matches the tag name only, so its fix would split `@acme/core` into `` `@acme`/core ``. When both rules are on, hand the same scope list to that rule's [`allowedInlineTags`](https://github.com/gajus/eslint-plugin-jsdoc/blob/main/docs/rules/escape-inline-tags.md#options) option, so each occurrence has one diagnostic and one fixer.

## Options

| Option                 | Type       | Default | Meaning                                                                                |
| ---------------------- | ---------- | ------- | -------------------------------------------------------------------------------------- |
| [`prefixes`](#options) | `string[]` | `[]`    | Package scopes, such as `"@acme"`, that must never appear bare in a JSDoc description. |

With no prefixes the rule reports nothing.

## Examples

### ❌ Incorrect, with { "prefixes": ["@acme"] }

<!-- options: {"prefixes": ["@acme"]} -->

```ts
/**
 * End-to-end tests for @acme/versioning
 */

/**
 * Entry point for the \@acme/package plugin.
 */

/**
 * @acme/workspace - a plugin for generated reports.
 */
```

### ✅ Correct, with { "prefixes": ["@acme"] }

<!-- options: {"prefixes": ["@acme"]} -->

```ts
/**
 * End-to-end tests for `@acme/versioning`
 */

/**
 * `@acme/workspace` - a plugin for generated reports.
 */

/**
 * The broker.
 *
 * @module @acme/nexus
 */
```

## When Not To Use It

When a project deliberately writes package references as JSDoc tags.

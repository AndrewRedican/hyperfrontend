# escape-package-tags

Require workspace package references in JSDoc descriptions to be wrapped in backticks.

## Rule Details

A JSDoc description that mentions a scoped package leaves an `@` at a word boundary. Every JSDoc parser, including TypeDoc, reads that `@` as the start of a tag. The mention is either swallowed into a bogus tag or truncates the description that follows it.

This rule finds those references and wraps them in backticks, which is both a valid escape and the correct markup for a package name.

### Why not a backslash escape?

`jsdoc/escape-inline-tags` offers `{@tag}`, `\@tag`, and `` `@tag` ``. Backticks are the right answer in this workspace:

- The docs site renders JSDoc descriptions through `simpleMarkdownToHtml` in `apps/docs-site/src/components/api-reference/description-markdown.tsx`. It converts `` `text` `` into a styled `<code>` element and has no handling for backslash escapes at all, so `\@hyperfrontend/versioning` would publish a literal stray backslash to the API reference.
- A package specifier is a code identifier. Rendering it as code is what a reader expects.
- Backticks are already the dominant convention across the workspace.

### Why not just `jsdoc/escape-inline-tags`?

The upstream rule matches `@(\w+)`, which stops at the `/`. Its fixer would turn `@hyperfrontend/versioning` into `` `@hyperfrontend`/versioning ``, splitting the specifier. This rule measures the whole specifier, including the scope, the package name, and any sub-path, and wraps it as a unit. Its fixer is also enabled by default, whereas the upstream fixer is opt-in.

### What is reported

A reference is reported when it starts a JSDoc description line or follows whitespace, matching the boundary the upstream rule uses. A leading backslash escape is included in the replacement so `\@hyperfrontend/logging` is normalised to `` `@hyperfrontend/logging` ``.

The following are left alone:

- References already wrapped in backticks.
- References embedded in quotes, such as `"@hyperfrontend/features"`.
- Everything from the first genuine block tag onwards, so `@module @hyperfrontend/versioning/git` and `@example` bodies are untouched.
- Fenced code blocks inside the description.
- A prefix that is only part of a longer word, such as `@hyperfrontendish`.

A description line that _opens_ with a guarded prefix is reported rather than treated as a tag. That case is exactly the corruption this rule exists to prevent.

## Options

| Option     | Type       | Default              | Description                                                               |
| ---------- | ---------- | -------------------- | ------------------------------------------------------------------------- |
| `prefixes` | `string[]` | `['@hyperfrontend']` | Package scope prefixes that must never appear bare in a JSDoc description |

`eslint.base.config.cjs` guards both the workspace scope and the Nx scope:

```javascript
'workspace/escape-package-tags': ['error', { prefixes: ['@hyperfrontend', '@nx'] }]
```

## Examples

### ❌ Incorrect

```typescript
/**
 * ESM E2E tests for @hyperfrontend/versioning
 */

/**
 * Entry point for the \@hyperfrontend/package Nx plugin.
 */

/**
 * @hyperfrontend/workspace - Nx plugin for LLM-optimized reports.
 */
```

### ✅ Correct

```typescript
/**
 * ESM E2E tests for `@hyperfrontend/versioning`
 */

/**
 * Entry point for the `@hyperfrontend/package` Nx plugin.
 */

/**
 * `@hyperfrontend/workspace` - Nx plugin for LLM-optimized reports.
 */

/**
 * The broker.
 *
 * @module @hyperfrontend/nexus
 */
```

## Pairing With `jsdoc/escape-inline-tags`

ESLint gives no ordering guarantee between rules, so this rule cannot be made to run first. It does not need to. `eslint.base.config.cjs` hands the same prefix list to `jsdoc/escape-inline-tags` as `allowedInlineTags`, which silences the upstream rule for the scopes this rule owns. One diagnostic and one fixer are responsible for each occurrence, and the upstream rule keeps guarding every other `@tag`.

## When Not To Use It

If a project deliberately writes package references as JSDoc tags.

## Related Rules

- [no-deprecated-tag](./no-deprecated-tag.md)
- [require-codeblock-language](./require-codeblock-language.md)

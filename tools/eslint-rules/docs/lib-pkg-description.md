# lib-pkg-description

Keep a publishable library's manifest description equal to the line its README opens with.

## Rule Details

A package states what it is in one sentence, and that sentence is read from two places: the README, where it sits below the badges and is what the documentation site and the search index lead with, and the manifest's `description` field, which the registry shows in search results and the documentation site reads into its package index. Two fields saying the same thing drift, and a reader who meets the package on the registry and then on its page should not be told two different things.

The README is where the sentence is written, because it is prose an author maintains beside the rest of the package's documentation. The manifest mirrors it. This rule reports a manifest whose `description` differs from the README's opening line and, with `--fix`, copies the line in.

The opening line is read the way `lib-readme-structure` reads it: the first line of text after the badges block. A package with no README, a README with no badges, or a README with no such line is left to that rule.

### What the rule reports

| Message            | Reported when                                                                  |
| ------------------ | ------------------------------------------------------------------------------ |
| `descriptionDrift` | The manifest's `description` is a string other than the README's opening line. |

A `description` that is missing or is not a string is left to `lib-pkg-fields`.

### Scope

Applies to the `package.json` at the root of every publishable library, and only there.

## Examples

### ❌ Incorrect

```json
{
  "name": "@hyperfrontend/logging",
  "description": "Structured logging utilities for applications."
}
```

With a README that opens:

```markdown
Structured logging with configurable severity levels and error-resilient execution.
```

### ✅ Correct

```json
{
  "name": "@hyperfrontend/logging",
  "description": "Structured logging with configurable severity levels and error-resilient execution."
}
```

## When Not To Use It

If a workspace wants its registry description written independently of its README, for instance shorter than the README's opening line, there is nothing here to keep equal.

## Related Rules

- [lib-pkg-fields](./lib-pkg-fields.md)
- [lib-readme-structure](./lib-readme-structure.md)

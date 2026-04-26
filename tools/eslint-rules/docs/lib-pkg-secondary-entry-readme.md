# lib-pkg-secondary-entry-readme

Ensure every secondary entrypoint declared in a publishable library `package.json` `exports` map has a `README.md` at the canonical path with at minimum an H1 matching the module name and a non-empty description line.

## Rule Details

The rule triggers on `package.json` files. It activates only for publishable libraries (those whose sibling `project.json` declares `projectType: "library"` plus `build` and `publish` targets), and is silent for everything else.

For each entry in the `exports` map, the rule:

1. Skips the primary entrypoint (`.`), the `package.json` self-reference, glob keys (`./*`, `./foo/*`), and any key without a leading `./`.
2. For each remaining concrete subpath (e.g. `./commits/parse`), asserts:
   - A README exists at `src/<subpath>/README.md` (relative to the library root).
   - The README starts with an H1 heading whose text matches the basename of the subpath.
   - A non-empty, non-heading line follows the H1 (the description).

Errors are reported on the corresponding `exports` entry node in `package.json`.

### H1 Matching

The H1 text is normalized before comparison: lowercased, with a trailing `/` and a trailing ` module` suffix stripped. All of the following are accepted for subpath `./heuristics`:

- `# heuristics`
- `# Heuristics`
- `# heuristics/`
- `# Heuristics Module`

### Description Check

The first non-blank line after the H1 must not start with `#`. Examples:

- `# parse\n\nParses commits.\n` → ✅ description present
- `# parse\n\n## Section\n` → ❌ first non-blank line is a heading
- `# parse\n` → ❌ no content beneath the H1

### Why?

- **Page rendering**: the docs-site submodule page renders the README above the auto-generated API reference. A missing README leaves the page bare.
- **Discoverability floor**: every npm-published submodule should have at least a one-sentence statement of purpose. The H1 + description requirement is the minimum that produces a usable page.
- **Drift detection**: when a developer adds `./foo/bar` to `package.json` `exports`, the rule flags the missing or malformed README before it ships to consumers.

## Examples

### ❌ Incorrect

A library declares a secondary entrypoint but the README is missing:

```json
// libs/versioning/package.json
{
  "exports": {
    ".": "./src/index.js",
    "./commits/parse": "./src/commits/parse/index.js"
  }
}
```

Errors (reported on the `./commits/parse` property):

```text
Secondary entrypoint './commits/parse' is missing required README at src/commits/parse/README.md
```

A README that lacks a description:

```markdown
<!-- libs/versioning/src/commits/parse/README.md -->

# parse
```

```text
Secondary entrypoint './commits/parse' README at src/commits/parse/README.md must include a description line beneath the H1
```

A README whose H1 does not match the module name:

```markdown
<!-- libs/versioning/src/commits/parse/README.md -->

# commit-parser

Parses commits.
```

```text
Secondary entrypoint './commits/parse' README at src/commits/parse/README.md must start with '# parse'
```

### ✅ Correct

```markdown
<!-- libs/versioning/src/commits/parse/README.md -->

# parse

Parses commit messages into structured records.
```

Additional sections (`## Overview`, `## Design`, mermaid diagrams, examples) are allowed and encouraged when the module's complexity warrants them. Manual API tables are not — the docs-site page renders the scoped API reference automatically.

## Configuration

Wired in [`eslint.base.config.cjs`](../../../eslint.base.config.cjs) alongside other `lib-pkg-*` rules:

```javascript
{
  files: ['**/package.json'],
  languageOptions: {
    parser: require('jsonc-eslint-parser'),
  },
  rules: {
    'workspace/lib-pkg-secondary-entry-readme': 'error',
  },
}
```

The rule's own `isPublishableLibrary()` check ensures it is silent for non-publishable libraries, application projects, and any `package.json` outside a library boundary.

## Related Rules

- [docs-site-secondary-entries](./docs-site-secondary-entries.md) — every secondary entrypoint has a `page.tsx` route and sidebar nav link in the docs-site.
- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md) — every `exports` path in a library's `package.json` resolves to a real file.
- [lib-readme-structure](./lib-readme-structure.md) — library-root README sections, badges, and links.

# lib-compatibility-matrix

Own the whole of the root `LIBRARY_COMPATIBILITY.md`, generating it from each package's `project.json` and `package.json`.

## Rule Details

The compatibility matrix is a generated document, not a hand-maintained one. This rule derives the document the workspace should hold, compares it with the file on disk, and reports one error when the two differ. The report carries a fix that replaces the entire file, so `nx lint:all` (or `nx lint @hyperfrontend/workspace --fix`) regenerates it and the document cannot drift.

The rule only runs on a file named `LIBRARY_COMPATIBILITY.md` that sits in the Nx workspace root. A copy anywhere else is ignored.

### Where The Facts Come From

Every publishable library under `libs/` and `plugins/` contributes one row. A directory counts when its `project.json` declares `projectType: "library"` with both a `build` and a `publish` target, and its `package.json` declares a name.

| Section             | Source                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| Platform Support    | `project.json` `metadata.compatibility.environments` and `metadata.compatibility.note` |
| Output Formats      | `project.json` `targets.build.options` keys `esm`, `cjs`, `iife`, `umd`                |
| Global name         | `globalName` on the `iife` and `umd` bundle options                                    |
| Engine Requirements | `package.json` `engines.node` and `engines.npm`                                        |
| Dependency Graph    | `package.json` `dependencies` and `peerDependencies`, first-party entries only         |
| Published Versions  | `package.json` `version`                                                               |

Rows are sorted by package name so the generated text is stable across machines.

### Environment Glyphs

`metadata.compatibility.environments` declares `full`, `partial` or `none` per environment. A package that declares nothing gets an explicit unknown glyph rather than an invented support level.

| Glyph | Meaning                                                |
| ----- | ------------------------------------------------------ |
| ✅    | `full`, or an output format the build produces         |
| ⚠️    | `partial`                                              |
| ❌    | `none`, or an output format the build does not produce |
| ❓    | nothing declared for that environment                  |

### Bundle Options

`iife` and `umd` accept either a single bundle object or an array of them. Both shapes are read, and the global names of every entry appear in one cell, first occurrence first, deduplicated across the two formats.

### Diagram

The dependency table is redrawn as a `flowchart TB`. Node identifiers replace every non-alphanumeric character with an underscore and carry the short package name as a label, which keeps the diagram parseable. A runtime dependency is a solid edge, a peer dependency a dotted one. An edge is omitted when its target is not itself a publishable library of this workspace.

## Examples

### ❌ Incorrect

A document edited by hand, so its version column no longer matches `package.json`:

```markdown
# Library Compatibility Matrix

## Published Versions

| Library                  | Version |
| ------------------------ | ------- |
| `@hyperfrontend/logging` | `0.0.1` |
```

A document carrying a date stamp, which is drift by construction:

```markdown
# Library Compatibility Matrix

Last updated: July 31, 2026
```

### ✅ Correct

The generated document, byte for byte:

```markdown
# Library Compatibility Matrix

> Generated from each package's `project.json` and `package.json`. Regenerate it with `npx nx lint:all` rather than editing it by hand.

## Platform Support

| Library                  | Node.js | Browser | Web Worker | CDN Bundle |
| ------------------------ | ------- | ------- | ---------- | ---------- |
| `@hyperfrontend/logging` | ✅      | ✅      | ✅         | ✅         |
```

## Why

- **One source of truth**: the matrix restates `project.json` and `package.json`, so it is derived from them rather than kept in step with them by hand.
- **Fixable**: a drifted document is repaired by the same lint run that reports it.
- **No date stamp**: a hand-written date is a claim about freshness that nothing verifies.
- **Complete**: a new publishable library appears in every table the moment it is added.

## Options

This rule has no configurable options.

## When Not To Use It

This rule is specific to the hyperfrontend monorepo's root compatibility document. Do not apply it to any other markdown file: it replaces the entire content of whatever it runs on.

## Related Rules

- [lib-project-metadata](./lib-project-metadata.md) validates the `metadata` block this document reads.
- [root-readme-packages](./root-readme-packages.md) checks the package list in the root README.
- [docs-site-libraries](./docs-site-libraries.md) checks the docs-site LIBRARIES array.

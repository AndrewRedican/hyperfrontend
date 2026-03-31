# lib-compatibility-docs

Ensure LIBRARY_COMPATIBILITY.md lists all libraries with browser bundles.

## Rule Details

This rule validates that the root workspace LIBRARY_COMPATIBILITY.md includes all publishable library projects that have browser bundles (IIFE/UMD) configured in their `project.json`.

Node.js-only tooling libraries (without IIFE/UMD build targets) are automatically excluded since they don't need browser compatibility documentation.

### What Libraries Are Required?

A library must be documented if:

1. Located in `libs/` or `plugins/` directory
2. Has a `project.json` with `projectType: "library"`
3. Has both `build` and `publish` targets defined
4. Has a `package.json` with a `name` field
5. Has `iife` or `umd` configured in `targets.build.options`

### Package Name Format

Libraries must be mentioned using backticks in the standard format:

```markdown
`@hyperfrontend/package-name`
```

This is typically found in markdown tables like:

```markdown
| Library                         | Browser | Node.js |
| ------------------------------- | :-----: | :-----: |
| `@hyperfrontend/data-utils`     |   ✅    |   ✅    |
| `@hyperfrontend/function-utils` |   ✅    |   ✅    |
```

### Why?

- **Focused**: Only browser-compatible libraries need platform compatibility docs
- **Automated**: Node.js tooling libraries are automatically excluded
- **Completeness**: Ensures all CDN-distributed packages have compatibility info
- **Maintainability**: CI can catch missing packages before merge

## Examples

### ❌ Incorrect

Missing a browser-bundled library:

```markdown
# Library Compatibility Matrix

## Platform Support Overview

| Library                     | Browser | Node.js | Web Worker |
| --------------------------- | :-----: | :-----: | :--------: |
| `@hyperfrontend/data-utils` |   ✅    |   ✅    |     ✅     |

<!-- Missing: @hyperfrontend/logging which has IIFE/UMD bundles -->
```

### ✅ Correct

All browser-bundled libraries listed (Node.js tooling excluded automatically):

```markdown
# Library Compatibility Matrix

## Platform Support Overview

| Library                     | Browser | Node.js | Web Worker |
| --------------------------- | :-----: | :-----: | :--------: |
| `@hyperfrontend/data-utils` |   ✅    |   ✅    |     ✅     |
| `@hyperfrontend/logging`    |   ✅    |   ✅    |     ✅     |

<!-- @hyperfrontend/versioning is NOT required — Node.js-only tooling -->
```

## Options

This rule has no configurable options.

## When Not To Use It

This rule is specific to the hyperfrontend monorepo's documentation practices. It should only be applied to the root LIBRARY_COMPATIBILITY.md file.

## Related Rules

- [root-readme-packages](./root-readme-packages.md) - Similar rule for README.md package listings
- [docs-site-libraries](./docs-site-libraries.md) - Similar rule for docs-site LIBRARIES array

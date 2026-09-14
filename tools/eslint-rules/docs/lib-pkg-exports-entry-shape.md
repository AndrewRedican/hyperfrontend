# lib-pkg-exports-entry-shape

Require every relative path in a publishable library's `exports` field to name an entry module: `./src/index.<ext>` or `./src/<dir>/index.<ext>`.

## Rule Details

The build discovers entry points by scanning `src/` for `index.ts` files: the root one and every nested directory that has one. Each published subpath is then mapped to the output built for the matching entry. A source `exports` value that points anywhere else (a file module such as `./src/utils.js`, a path outside `src/`, a non-`index` file) names something the build never produces, so the subpath is dropped from the published `exports` and consumers that import it fail with "subpath not defined".

The subpath key is free to differ from the directory (`"./queue": "./src/lib/queue/index.js"` is valid); only the value's shape is checked. `./package.json` self-references and bare specifiers are left to other rules.

### Why?

- **Correctness**: A declared subpath that the build cannot map disappears from the published package
- **Early detection**: The mismatch is caught while editing `package.json`, not at a consumer's install
- **Intent**: Anything meant to be a public entry lives in `src/**/index.ts`; anything deliberately internal does not

## Examples

### ❌ Incorrect

```json
{
  "exports": {
    "./core/logger": "./src/core/logger.js",
    "./lib": "./lib/index.js",
    "./spec": "./src/spec/index.spec.js"
  }
}
```

### ✅ Correct

```json
{
  "exports": {
    ".": "./src/index.js",
    "./core/logger": "./src/core/logger/index.js",
    "./queue": "./src/lib/queue/index.js",
    "./package.json": "./package.json"
  }
}
```

## Fixable

No. Moving a module into its entry directory is a source change, not a manifest edit.

## When Not To Use It

Never for publishable libraries in this workspace; the build's entry discovery is the contract this rule mirrors.

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
- [lib-pkg-exports-js-only](./lib-pkg-exports-js-only.md)
- [lib-pkg-secondary-entry-readme](./lib-pkg-secondary-entry-readme.md)

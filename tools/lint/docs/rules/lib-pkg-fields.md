# lib-pkg-fields

Require essential fields in publishable library package.json files.

## Rule Details

This rule ensures publishable libraries have all required metadata fields in their `package.json`:

- `name` - Package identifier
- `description` - Package description
- `license` - License identifier (e.g., "MIT")
- `sideEffects` - Tree-shaking hint for bundlers
- `engines` - Supported Node.js versions
- `keywords` - Discoverability keywords

### Why?

- **npm compliance**: Required fields for publishing to npm
- **Discoverability**: Keywords and description help users find your package
- **Bundler optimization**: `sideEffects: false` enables tree-shaking
- **Compatibility**: `engines` documents Node.js version requirements

## Examples

### ❌ Incorrect

```json
{
  "name": "@hyperfrontend/my-lib"
}
```

### ✅ Correct

```json
{
  "name": "@hyperfrontend/my-lib",
  "description": "Utility functions for handling data",
  "license": "MIT",
  "sideEffects": false,
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": ["utils", "data", "hyperfrontend"]
}
```

## When Not To Use It

If you have a different set of required fields or use a publication workflow that adds these fields automatically.

## Related Rules

- [lib-pkg-no-main](./lib-pkg-no-main.md)
- [lib-pkg-package-json-export](./lib-pkg-package-json-export.md)

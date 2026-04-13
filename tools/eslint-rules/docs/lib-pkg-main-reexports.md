# lib-pkg-main-reexports

Require main entry point to re-export all secondary entry points for barrel topology libraries.

## Rule Details

This rule ensures that publishable packages with barrel topology properly re-export all secondary entry points from their main entry. This prevents APIs from being silently missing when consumers use the main entry point.

### Why?

- **API completeness**: Consumers using the main entry (`.`) expect access to the full API
- **Tree-shaking support**: Secondary entry points exist for optimization; main should expose everything
- **Discoverability**: Prevents accidental API omissions when adding new modules

### API Topology Modes

The rule supports three topology modes to accommodate different library designs:

| Topology     | Description                           | Main Entry            | Re-export Required |
| ------------ | ------------------------------------- | --------------------- | ------------------ |
| `barrel`     | Main re-exports all secondary entries | `.`                   | Yes                |
| `isomorphic` | Platform-specific parallel mains      | `./browser`, `./node` | No                 |
| `fragmented` | Independent entry points              | None required         | No                 |

## Examples

### ❌ Incorrect (barrel topology)

**package.json:**

```json
{
  "exports": {
    ".": "./src/index.js",
    "./actions": "./src/actions/index.js",
    "./events": "./src/events/index.js",
    "./package.json": "./package.json"
  }
}
```

**src/index.ts:**

```typescript
export * from './actions'
// Missing: export * from './events'
```

### ✅ Correct (barrel topology)

**package.json:**

```json
{
  "exports": {
    ".": "./src/index.js",
    "./actions": "./src/actions/index.js",
    "./events": "./src/events/index.js",
    "./package.json": "./package.json"
  }
}
```

**src/index.ts:**

```typescript
export * from './actions'
export * from './events'
```

### ✅ Correct (isomorphic topology)

For isomorphic packages, no main re-export is required:

**package.json:**

```json
{
  "exports": {
    "./browser": "./src/browser/index.js",
    "./node": "./src/node/index.js",
    "./common": "./src/common/index.js",
    "./package.json": "./package.json"
  }
}
```

## Options

```typescript
interface RuleOptions {
  /**
   * API topology mode.
   * @default 'barrel'
   */
  topology?: 'barrel' | 'isomorphic' | 'fragmented'

  /**
   * Entry points to exclude from validation.
   * @example ['./internal', './testing']
   */
  exclude?: string[]

  /**
   * For isomorphic: parallel main entry points.
   * @default ['./browser', './node']
   */
  mainEntryPoints?: string[]
}
```

### Example Configurations

**Default (barrel):**

```javascript
'@nx/eslint-plugin-workspace/lib-pkg-main-reexports': 'error'
```

**Isomorphic package:**

```javascript
'@nx/eslint-plugin-workspace/lib-pkg-main-reexports': ['error', { topology: 'isomorphic' }]
```

**Barrel with exclusions:**

```javascript
'@nx/eslint-plugin-workspace/lib-pkg-main-reexports': [
  'error',
  { topology: 'barrel', exclude: ['./testing', './internal'] }
]
```

**Fragmented (no validation):**

```javascript
'@nx/eslint-plugin-workspace/lib-pkg-main-reexports': ['error', { topology: 'fragmented' }]
```

## When Not To Use It

- **Single entry point libraries**: If your package only has `.` and `./package.json` exports
- **Intentionally fragmented APIs**: When entry points are designed to be independent
- **Platform-specific libraries**: Use `isomorphic` topology instead of disabling

## Nested Entry Points

For packages with nested entry points (e.g., `./changelog/parse`), the rule groups by top-level directory. You only need to re-export the top-level module:

**package.json:**

```json
{
  "exports": {
    ".": "./src/index.js",
    "./changelog": "./src/changelog/index.js",
    "./changelog/parse": "./src/changelog/parse/index.js",
    "./changelog/serialize": "./src/changelog/serialize/index.js"
  }
}
```

**src/index.ts (only top-level needed):**

```typescript
export * from './changelog'
```

## Related Rules

- [lib-pkg-exports-exist](./lib-pkg-exports-exist.md)
- [lib-pkg-bundle-entry](./lib-pkg-bundle-entry.md)
- [no-unwanted-barrel-files](./no-unwanted-barrel-files.md)

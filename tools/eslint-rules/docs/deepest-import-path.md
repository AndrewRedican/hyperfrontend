# deepest-import-path

Require imports to use the deepest available package subpath.

## Rule Details

This rule enforces that imports from workspace packages use the most specific (deepest) available import path rather than importing from the main package entry point when a more specific subpath could be used.

### Why?

- **Explicit dependencies**: Make it clear which part of a package is being used
- **Better tree-shaking**: More specific imports enable better dead code elimination
- **Faster builds**: Bundlers can skip parsing unused package subpaths
- **Clearer code organization**: Imports reflect the actual module structure
- **Reduced coupling**: Changes to unrelated subpaths don't affect your imports

## Examples

### ❌ Incorrect

```typescript
// When '@hyperfrontend/project-scope/cli' exports runCli
import { runCli } from '@hyperfrontend/project-scope'

// Multiple symbols from same deeper subpath
import { runCli, parseArgs } from '@hyperfrontend/project-scope'

// Type imports
import type { CliConfig } from '@hyperfrontend/project-scope'
```

### ✅ Correct

```typescript
// Use the most specific subpath that exports the symbol
import { runCli } from '@hyperfrontend/project-scope/cli'

// Multiple symbols from same subpath
import { runCli, parseArgs } from '@hyperfrontend/project-scope/cli'

// Type imports from specific subpath
import type { CliConfig } from '@hyperfrontend/project-scope/cli'

// Still allowed: symbols that only exist at the base level
import { uniqueRootSymbol } from '@hyperfrontend/project-scope'

// Still allowed: symbols from different subpaths (no common deeper path)
import { runCli, parseConfig } from '@hyperfrontend/project-scope'
// (when runCli is from /cli and parseConfig is from /config)
```

## Options

### `packagePrefix`

Type: `string`
Default: `'@hyperfrontend/'`

The package prefix to check. Only imports starting with this prefix will be analyzed.

```javascript
// eslint.config.js
{
  rules: {
    'workspace/deepest-import-path': ['error', { packagePrefix: '@myorg/' }]
  }
}
```

## How It Works

1. The rule reads `tsconfig.base.json` to discover all available import paths for workspace packages
2. For each import from a matching package:
   - Extracts the imported symbol names
   - Parses the barrel files (index.ts) for each available subpath
   - Finds the deepest subpath that exports **all** imported symbols
3. If a deeper path exists, reports an error with an auto-fix

## Handling Multiple Imports

When importing multiple symbols, the rule only suggests a deeper path if **all** symbols are exported from the same deeper subpath:

```typescript
// ❌ Reports: both runCli and parseArgs are in @hyperfrontend/project-scope/cli
import { runCli, parseArgs } from '@hyperfrontend/project-scope'

// ✅ No report: runCli is from /cli, parseConfig is from /config
// No single deeper path contains both
import { runCli, parseConfig } from '@hyperfrontend/project-scope'
```

## Import Styles Supported

- Named imports: `import { foo } from '...'`
- Type imports: `import type { Foo } from '...'`
- Mixed type/value: `import { type Foo, bar } from '...'`
- Aliased imports: `import { foo as bar } from '...'`

## Not Checked

The following are not checked by this rule:

- **Default imports**: `import Pkg from '@hyperfrontend/pkg'`
- **Namespace imports**: `import * as Pkg from '@hyperfrontend/pkg'`
- **Side-effect imports**: `import '@hyperfrontend/pkg'`
- **External packages**: `import { foo } from 'lodash'`
- **Relative imports**: `import { foo } from './helper'`
- **Node built-ins**: `import { readFile } from 'node:fs'`

## When Not To Use It

- If your build tooling already optimizes imports regardless of depth
- If you intentionally want to use top-level imports for API stability
- For packages that don't have meaningful subpath exports

## Fixable

This rule is auto-fixable. Run ESLint with the `--fix` flag to automatically update imports to use the deepest available path.

The fixer preserves your quote style (single or double quotes).

## Related Rules

- [import-order](./import-order.md) - Enforce import ordering
- [no-namespace-import](./no-namespace-import.md) - Prohibit namespace imports
- [lib-tsconfig-paths](./lib-tsconfig-paths.md) - Ensure tsconfig paths are properly configured

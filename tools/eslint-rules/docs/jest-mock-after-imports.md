# jest-mock-after-imports

Enforce that `jest.mock()` calls appear after all import statements.

## Rule Details

Jest hoists `jest.mock()` (and `jest.unmock()`, `jest.enableAutomock()`, `jest.disableAutomock()`) above the imports at runtime regardless of where they sit in the source. Writing them _before_ the imports therefore misrepresents the execution order and pushes the real module dependencies below a wall of mock boilerplate.

This rule requires every hoisted Jest mock-registration call to be written **after** all `import` statements. It is applied to every `*.spec.ts` file in the workspace.

### Why?

- **Readability**: The import block stays at the very top where readers expect it.
- **Honest ordering**: Source order matches what the reader can rely on — imports first, then the mocks that Jest hoists above them anyway.
- **Consistency**: Every spec file follows the same top-of-file shape.

## Examples

### ❌ Incorrect

```typescript
jest.mock('./warn-handler', () => {
  const sentinel = jest.fn()
  return { createSuppressingOnWarn: jest.fn(() => sentinel), __sentinel: sentinel }
})
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))

import type { BuildContext } from '../../models'
import { createUmdConfig } from './config-umd'
import { createSuppressingOnWarn } from './warn-handler'
```

### ✅ Correct

```typescript
import type { BuildContext } from '../../models'
import { createUmdConfig } from './config-umd'
import { createSuppressingOnWarn } from './warn-handler'

jest.mock('./warn-handler', () => {
  const sentinel = jest.fn()
  return { createSuppressingOnWarn: jest.fn(() => sentinel), __sentinel: sentinel }
})
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
```

## Options

This rule has no configurable options.

## When Not To Use It

If you intentionally rely on a different convention for ordering mocks relative to imports.

## Fixable

This rule is auto-fixable. Run ESLint with the `--fix` flag to move the imports above the mock calls. The fix is skipped when an unrelated statement is interleaved between the imports and mocks, since reordering could not be performed safely.

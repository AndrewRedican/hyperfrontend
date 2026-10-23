# jest-mock-after-imports

Require `jest.mock()` and `jest.unmock()` calls to come after every import statement.

## Rule Details

Jest's transform hoists mock registrations above the imports, and the load hook of [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/) finds them wherever they sit, so placement does not change execution: the mocks register first either way. Writing them before the imports buys nothing and pushes the module's real dependencies below a wall of mock boilerplate. The rule reports each top-level `jest.mock()` or `jest.unmock()` call that comes before the last import.

The fix moves the imports above the mock calls, keeping each group's order. It is offered only when the imports and mocks form one unbroken run; with another statement among them the rule reports without a fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
jest.mock('./warn-handler', () => ({ createHandler: jest.fn() }))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))

import type { BuildContext } from '../../models'
import { createConfig } from './config'
import { createHandler } from './warn-handler'
```

### ✅ Correct

```ts
import type { BuildContext } from '../../models'
import { createConfig } from './config'
import { createHandler } from './warn-handler'

jest.mock('./warn-handler', () => ({ createHandler: jest.fn() }))
jest.mock('@rollup/plugin-json', () => jest.fn(() => ({ name: 'json' })))
```

## Limitations

Only calls on an object named jest, written as top-level statements, are read; a mock registered through another name or inside a block is not seen.

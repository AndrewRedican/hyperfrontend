# no-direct-console

Enforce using `@hyperfrontend/logging` instead of direct console methods, `@nx/devkit` logger, or `@hyperfrontend/immutable-api-utils` console methods.

## Rule Details

This rule prevents using:

- Global `console.*` methods (e.g., `console.log`, `console.warn`, `console.error`)
- `logger` from `@nx/devkit`
- Console methods from `@hyperfrontend/immutable-api-utils/built-in-copy/console`

Instead, use the standardized logging APIs from `@hyperfrontend/logging`.

### Why?

- **Consistency**: A single logging library ensures consistent log formatting and behavior
- **Configurability**: `@hyperfrontend/logging` provides log level filtering and configuration
- **Type Safety**: Properly typed logger interfaces with validated log functions
- **Testability**: Loggers created with `createLogger` can be mocked and tested
- **Production Ready**: Built-in support for log level filtering (none, error, warn, log, info, debug)

## Examples

### ❌ Incorrect

```typescript
// Direct console usage
console.log('Processing item')
console.error('Something failed')
console.warn('Deprecated API usage')

// @nx/devkit logger
import { logger } from '@nx/devkit'
logger.info('Starting generator')
logger.error('Generator failed')

// Calling immutable-api-utils console functions directly
import { log, error } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
log('Processing complete')
error('Operation failed')
```

### ✅ Correct

```typescript
// Use the pre-configured logger
import { logger } from '@hyperfrontend/logging'

logger.log('Processing item')
logger.error('Something failed')
logger.warn('Deprecated API usage')

// Or create a custom logger with console.* or immutable copies as transport handlers
import { error, warn, log, info, debug } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { createLogger } from '@hyperfrontend/logging'

const appLogger = createLogger(error, warn, log, info, debug)

appLogger.log('Custom logger initialized')
appLogger.setLogLevel('debug') // Enable all log levels

// Wrap @nx/devkit logger for Nx executor/generator integration
import { logger as nxLogger } from '@nx/devkit'
import { createLogger } from '@hyperfrontend/logging'

export const logger = createLogger(nxLogger.error, nxLogger.warn, nxLogger.log, nxLogger.info, nxLogger.debug)
```

## Available APIs from @hyperfrontend/logging

The rule dynamically reads the public API from `@hyperfrontend/logging`. Common exports include:

| Export                 | Description                                                               |
| ---------------------- | ------------------------------------------------------------------------- |
| `createLogger`         | Factory function to create custom logger instances                        |
| `logger`               | Pre-configured logger instance using console methods                      |
| `createLogLevelConfig` | Create log level configuration with filtering                             |
| `isValidLogger`        | Validate if an object is a proper logger                                  |
| `Logger`               | TypeScript type for logger interface                                      |
| `LogLevel`             | Log level type: 'none' \| 'error' \| 'warn' \| 'log' \| 'info' \| 'debug' |

## Options

This rule has no configurable options.

## When Not To Use It

- In test setup files where mocking console may be necessary
- In build scripts where `@hyperfrontend/logging` is not available
- In browser environments where the logging library is not bundled

## Related Rules

- [no-async-fs-api](./no-async-fs-api.md) - Similar pattern of prohibiting certain APIs
- [require-node-protocol](./require-node-protocol.md) - Consistent import patterns

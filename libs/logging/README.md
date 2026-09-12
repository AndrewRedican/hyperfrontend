# @hyperfrontend/logging

<p align="center">
  <a href="https://github.com/AndrewRedican/hyperfrontend/actions/workflows/ci-lib-logging.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/AndrewRedican/hyperfrontend/ci-lib-logging.yml?style=flat-square&logo=github&label=build" alt="Build">
  </a>
  <a href="https://codecov.io/gh/AndrewRedican/hyperfrontend/flags?flags%5B0%5D=logging">
    <img src="https://codecov.io/gh/AndrewRedican/hyperfrontend/graph/badge.svg?flag=logging" alt="Coverage">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/logging">
    <img src="https://img.shields.io/npm/v/@hyperfrontend/logging?style=flat-square" alt="npm version">
  </a>
  <a href="https://bundlephobia.com/package/@hyperfrontend/logging">
    <img src="https://img.shields.io/bundlephobia/min/%40hyperfrontend%2Flogging?style=flat-square" alt="npm bundle size">
  </a>
</p>
<p align="center">
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors">
    <img src="https://img.shields.io/github/all-contributors/AndrewRedican/hyperfrontend?color=ee8449&style=flat-square" alt="All Contributors">
  </a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  <a href="https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </a>
  <a href="https://www.npmjs.com/package/@hyperfrontend/logging">
    <img src="https://img.shields.io/npm/dm/@hyperfrontend/logging?style=flat-square" alt="npm downloads">
  </a>
  <a href="https://github.com/AndrewRedican/hyperfrontend">
    <img src="https://img.shields.io/github/stars/AndrewRedican/hyperfrontend?style=flat-square" alt="GitHub stars">
  </a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/tree%20shakeable-%E2%9C%93-success?style=flat-square" alt="Tree Shakeable">
</p>

<p align="center">
  <a href="https://www.hyperfrontend.dev/docs/libraries/logging/">
    <img width="640" src="https://www.hyperfrontend.dev/media/logging-levels/hero.gif" alt="A terminal running one release script three times: the default level prints a single tagged line, LOG_LEVEL=debug prints three with elapsed milliseconds, and the last run ends in a red failure line reporting how long it took to fail">
  </a>
</p>
<p align="center">
  <sub>One program, three runs. The emitting code is written once; how much of it reaches the terminal is decided at run time.</sub>
</p>

Structured logging with configurable severity levels and error-resilient execution.

• 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/logging/)
• 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package=%40hyperfrontend%2Flogging)

## What is @hyperfrontend/logging?

@hyperfrontend/logging provides a production-grade logging abstraction that wraps console-like log functions from any backend (console, Winston, Bunyan) with runtime log level control and automatic error handling. Unlike basic console wrappers, this library enables dynamic severity filtering without code changes or environment restarts - adjust verbosity in running production systems via the `setLogLevel()` API.

The core `createLogger()` factory accepts custom log functions for each severity level (error, warn, log, info, debug), wrapping them with conditional execution based on current log level and automatic error suppression to prevent logging failures from crashing applications. A pre-configured `logger` instance using console methods is available for immediate use.

### Key Features

- **Runtime Log Level Control** - Adjust logging verbosity dynamically via `setLogLevel()` without restarting processes
- **Priority-Based Filtering** - Log levels follow standard hierarchy (error > warn > log > info > debug) with automatic filtering
- **Error-Resilient Execution** - All log functions wrapped with error handlers to prevent logging failures from propagating
- **Console Abstraction** - Accepts one console-like function per level, from console, Winston, Bunyan or a custom implementation
- **Conditional Execution** - Log functions only execute when current severity meets or exceeds configured threshold
- **Frozen Interfaces** - Logger instances are immutable to prevent runtime modification
- **Zero External Dependencies** - Self-contained implementation with no third-party runtime dependencies
- **Type-Safe API** - Full TypeScript support with strongly-typed log functions and levels

## Why Use @hyperfrontend/logging?

### Production Observability Without Restarts

Debugging production issues requires adjusting log verbosity on running systems without downtime. Traditional logging requires environment variable changes and process restarts, delaying issue resolution. This library exposes `setLogLevel()` APIs that adjust verbosity at runtime - increase debug output during incidents, then return to error-only logging once resolved. Integrate with admin endpoints or monitoring tools to control logging remotely.

### Prevent Logging Failures from Cascading

Logging operations can fail (network issues for remote transports, serialization errors for complex objects, disk space for file logs). Standard console methods throw synchronously, potentially crashing applications during log operations. This library wraps every log function with error suppression - if logging fails, the error is swallowed and execution continues. Your application stays stable even when logging infrastructure fails.

### Uniform Logging Interface Across Environments

Applications often use different logging libraries in different environments (console in development, Winston in Node.js production, browser-specific loggers in frontend). This creates environment-specific code branches and inconsistent log formats. Pass any backend's log functions to `createLogger()` and receive a uniform API across all environments. Switch underlying implementations without changing application code.

### Testable Logging Logic with Dependency Injection

Testing code with direct `console.log()` calls requires mocking global objects or capturing stdout, creating brittle tests. This library uses dependency injection - pass mock functions to `createLogger()` during tests to capture log output programmatically. Verify log messages, assert call counts, and test conditional logging behavior without environment manipulation.

### Minimize Production Log Volume Costs

Cloud logging services charge per log entry and storage volume. Applications using `console.log()` everywhere generate excessive logs, inflating costs without proportional debugging value. Set default log level to 'error' in production to capture only critical issues, then selectively enable verbose logging during investigations. Reduce log volume by 90%+ while maintaining debugging capabilities when needed.

## Installation

```bash
npm install @hyperfrontend/logging
```

## Quick Start

### Using the Pre-Configured Logger

```typescript
import { logger } from '@hyperfrontend/logging'

// Default level is 'error' - only error logs execute
logger.error('Critical failure', { code: 500 }) // ✅ Logged
logger.warn('Deprecation notice') // ❌ Filtered
logger.info('Request completed') // ❌ Filtered

// Increase verbosity at runtime
logger.setLogLevel('info')
logger.info('Request completed') // ✅ Now logged

// Check current level
console.log(logger.getLogLevel()) // 'info'

// Disable all logging
logger.setLogLevel('none')
```

### Creating Custom Loggers

```typescript
import { createLogger } from '@hyperfrontend/logging'
import winston from 'winston'

// Wrap Winston logger
const winstonLogger = createLogger(
  winston.error.bind(winston),
  winston.warn.bind(winston),
  winston.log.bind(winston),
  winston.info.bind(winston),
  winston.debug.bind(winston)
)

// Custom logger with structured output
const structuredLogger = createLogger(
  (msg, meta) => console.error(JSON.stringify({ level: 'error', msg, meta })),
  (msg, meta) => console.warn(JSON.stringify({ level: 'warn', msg, meta })),
  (msg, meta) => console.log(JSON.stringify({ level: 'log', msg, meta })),
  (msg, meta) => console.info(JSON.stringify({ level: 'info', msg, meta })),
  (msg, meta) => console.debug(JSON.stringify({ level: 'debug', msg, meta }))
)
```

### Dynamic Log Level Control

```typescript
import { createLogger } from '@hyperfrontend/logging'
import express from 'express'

const { error, warn, log, info, debug } = console
const logger = createLogger(error, warn, log, info, debug)

// Admin endpoint to control log level
const app = express()
app.post('/admin/log-level', (req, res) => {
  const { level } = req.body
  logger.setLogLevel(level)
  res.json({ level: logger.getLogLevel() })
})

// Automatically increase verbosity during errors
process.on('uncaughtException', () => {
  logger.setLogLevel('debug') // Enable debug logs for debugging
})
```

### Testing Logging Behavior

```typescript
import { createLogger } from '@hyperfrontend/logging'

test('logs only errors at error level', () => {
  const error = jest.fn()
  const warn = jest.fn()
  const logger = createLogger(error, warn)

  logger.setLogLevel('error')
  logger.error('Critical')
  logger.warn('Warning')

  expect(error).toHaveBeenCalledWith('Critical')
  expect(warn).not.toHaveBeenCalled()
})
```

### Channels and Timing

```typescript
import { createLogger } from '@hyperfrontend/logging'

const { error, warn, log, info, debug } = console
const logger = createLogger(error, warn, log, info, debug)
logger.setLogLevel('debug')

// channel() returns a sub-logger that prepends `[prefix]` to every emission.
// Nested channels chain with `:`; channel('build').channel('rollup') emits `[build:rollup]`.
const build = logger.channel('build')
build.info('starting') // [build] starting
build.channel('rollup').warn(':') // [build:rollup] :

// timed() wraps a sync call: success -> debug "<label> completed in Nms",
// failure -> error "<label> failed after Nms: <message>" then rethrows.
const value = build.timed('compute', () => expensiveSync())

// timedAsync() does the same for promise-returning calls and additionally
// dumps the stack trace to debug on rejection.
await build.timedAsync('bundle', async () => bundleAsync())
```

## API Overview

One factory and one ready-made instance. [`createLogger`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-createLogger) takes five plain sink functions in severity order (error, warn, log, info, debug) and hands back a frozen logger; only the first is required, and the rest fall back to no-ops. Each sink you pass is wrapped twice on the way in: once so that a sink which throws (a dead socket, an unserializable object) can never surface at your call site, and once by a level check shared with every other method on the logger. The exported [`logger`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-logger) is that same factory already applied to the console methods, for when you do not need your own sinks.

Verbosity is one dial rather than a build-time constant. `setLogLevel` and `getLogLevel` read and write state shared by the whole logger, so an admin endpoint or a signal handler can open the tap on a running process. A [`LogLevel`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-LogLevel) is one of `'none'`, `'error'`, `'warn'`, `'log'`, `'info'` or `'debug'`, and setting one admits it plus everything more severe. Note that `log` outranks `info` here, so a logger at `'log'` still prints warnings and summaries while dropping the play-by-play. A fresh logger starts at `'error'`.

Two affordances do the structuring. [`channel`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-Logger-prop-channel) returns a sub-logger that prepends `[prefix]` as its own leading argument; channels nest and join with a colon, so `logger.channel('release').channel('npm')` emits `[release:npm]`. [`timed`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-Logger-prop-timed) and [`timedAsync`](https://www.hyperfrontend.dev/docs/libraries/logging/#api-Logger-prop-timedAsync) wrap a call and return whatever it returned, emitting `<label> completed in <n>ms` at debug on success and `<label> failed after <n>ms: <message>` at error on failure before rethrowing, so timing instrumentation never changes control flow. On a rejection `timedAsync` also sends the stack trace to debug.

Beside those sit two predicates and a lower-level piece: `isValidLogger` and `isValidLogLevel` for guarding values that arrive from configuration or a request body, and `createLogLevelConfig` when you want the priority machinery on its own without any sinks attached.

Every type, parameter and return shape is in the [API reference](https://www.hyperfrontend.dev/docs/libraries/logging/#api-reference).

## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Web Workers                   |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |

### Output Formats

| Format | File                       | Tree-Shakeable |
| ------ | -------------------------- | :------------: |
| ESM    | `index.esm.js`             |       ✅       |
| CJS    | `index.cjs.js`             |       ❌       |
| IIFE   | `bundle/index.iife.min.js` |       ❌       |
| UMD    | `bundle/index.umd.min.js`  |       ❌       |

### CDN Usage

```html
<!-- unpkg -->
<script src="https://unpkg.com/@hyperfrontend/logging"></script>

<!-- jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@hyperfrontend/logging"></script>

<script>
  const { createLogger } = HyperfrontendLogging
</script>
```

**Global variable:** `HyperfrontendLogging`

## Part of hyperfrontend

This library is part of the [hyperfrontend](https://github.com/AndrewRedican/hyperfrontend) monorepo.

**📖 [Full documentation](https://www.hyperfrontend.dev/docs/libraries/logging)**

- Built on [@hyperfrontend/function-utils](https://github.com/AndrewRedican/hyperfrontend/tree/main/libs/utils/function) for error-resilient execution

## License

[MIT](https://github.com/AndrewRedican/hyperfrontend/blob/main/LICENSE.md)

# @hyperfrontend/logging

Structured logging with configurable severity levels and error-resilient execution.

## What is @hyperfrontend/logging?

@hyperfrontend/logging provides a production-grade logging abstraction that wraps any console-like interface (console, Winston, Bunyan) with runtime log level control and automatic error handling. Unlike basic console wrappers, this library enables dynamic severity filtering without code changes or environment restarts - adjust verbosity in running production systems via the `setLogLevel()` API.

The core `createLogger()` factory accepts custom log functions for each severity level (error, warn, log, info, debug), wrapping them with conditional execution based on current log level and automatic error suppression to prevent logging failures from crashing applications. A pre-configured `logger` instance using console methods is available for immediate use.

### Key Features

- **Runtime Log Level Control** - Adjust logging verbosity dynamically via `setLogLevel()` without restarting processes
- **Priority-Based Filtering** - Log levels follow standard hierarchy (error > warn > log > info > debug) with automatic filtering
- **Error-Resilient Execution** - All log functions wrapped with error handlers to prevent logging failures from propagating
- **Console Abstraction** - Accepts any console-like interface (console, Winston, Bunyan, custom implementations)
- **Conditional Execution** - Log functions only execute when current severity meets or exceeds configured threshold
- **Frozen Interfaces** - Logger instances are immutable to prevent runtime modification
- **Zero External Dependencies** - Self-contained implementation using only internal hyperfrontend utilities
- **Type-Safe API** - Full TypeScript support with strongly-typed log functions and levels

### Architecture Highlights

Built on functional composition with dependency injection for complete testability. Each log function is wrapped in two layers: error suppression (via `createErrorIgnoringFunction`) prevents exceptions during logging, and conditional execution (via `createConditionalExecutionFunction`) checks log level before execution. The priority system evaluates numeric thresholds rather than string comparisons for efficient runtime filtering.

## Why Use @hyperfrontend/logging?

### Production Observability Without Restarts

Debugging production issues requires adjusting log verbosity on running systems without downtime. Traditional logging requires environment variable changes and process restarts, delaying issue resolution. This library exposes `setLogLevel()` APIs that adjust verbosity at runtime - increase debug output during incidents, then return to error-only logging once resolved. Integrate with admin endpoints or monitoring tools to control logging remotely.

### Prevent Logging Failures from Cascading

Logging operations can fail (network issues for remote transports, serialization errors for complex objects, disk space for file logs). Standard console methods throw synchronously, potentially crashing applications during log operations. This library wraps every log function with error suppression - if logging fails, the error is swallowed and execution continues. Your application stays stable even when logging infrastructure fails.

### Uniform Logging Interface Across Environments

Applications often use different logging libraries in different environments (console in development, Winston in Node.js production, browser-specific loggers in frontend). This creates environment-specific code branches and inconsistent log formats. Pass any console-like interface to `createLogger()` and receive a uniform API across all environments. Switch underlying implementations without changing application code.

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

const logger = createLogger(console.error, console.warn, console.log, console.info, console.debug)

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

## API Overview

### Logger Factory

- **`createLogger(error, warn?, log?, info?, debug?): Logger`** - Create logger with custom log functions
  - All functions wrapped with error handling and level filtering
  - Only `error` function is required, others default to noop

### Logger Instance Methods

- **`logger.error(...data: any[]): void`** - Log error-level messages (always logged unless level is 'none')
- **`logger.warn(...data: any[]): void`** - Log warning-level messages
- **`logger.log(...data: any[]): void`** - Log standard messages
- **`logger.info(...data: any[]): void`** - Log informational messages
- **`logger.debug(...data: any[]): void`** - Log debug messages (lowest priority)
- **`logger.setLogLevel(level: LogLevel): void`** - Set minimum log level at runtime
- **`logger.getLogLevel(): LogLevel`** - Get current log level

### Log Levels (Priority Order)

- **`'none'`** - Disable all logging
- **`'error'`** - Only error logs (highest priority)
- **`'warn'`** - Error and warning logs
- **`'log'`** - Error, warning, and standard logs
- **`'info'`** - Error, warning, log, and info logs
- **`'debug'`** - All logs (lowest priority)

### Validation Utilities

- **`isValidLogger(logger: unknown): boolean`** - Check if object is valid Logger instance
- **`isValidLogLevel(level: LogLevel): boolean`** - Validate log level string

### Pre-Configured Instance

- **`logger`** - Ready-to-use logger wrapping console methods (default level: 'error')

## License

MIT

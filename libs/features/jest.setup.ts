import { TextEncoder, TextDecoder } from 'node:util'

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
})

/**
 * Mock freeze as a passthrough to allow jest.spyOn and Object.defineProperty
 * to work on handles and registries during tests.
 *
 * Freeze behavior is verified separately via `Object.isFrozen()` assertions.
 */
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/object', () => ({
  ...jest.requireActual('@hyperfrontend/immutable-api-utils/built-in-copy/object'),
  freeze: <T>(obj: T): T => obj,
}))

/**
 * Mock console built-in copies to use actual console methods.
 *
 * The logging module captures console references at module load time from
 * immutable-api-utils. This mock ensures jest.spyOn(console, ...) captures
 * calls made through those references.
 */
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/console', () => ({
  error: (...args: unknown[]) => console.error(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  log: (...args: unknown[]) => console.log(...args),
  info: (...args: unknown[]) => console.info(...args),
  debug: (...args: unknown[]) => console.debug(...args),
}))

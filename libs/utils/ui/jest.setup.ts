jest.useFakeTimers()

/**
 * Mock object built-in copies so freeze is a no-op in tests.
 *
 * The logger object is created with freeze(), which makes it non-writable.
 * Without this mock, jest.spyOn() cannot replace methods on the logger.
 */
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/object', () => ({
  ...jest.requireActual('@hyperfrontend/immutable-api-utils/built-in-copy/object'),
  freeze: <T>(obj: T): T => obj,
}))

/**
 * Mock console built-in copies to use actual console methods.
 *
 * The ui-utils modules capture console references at module load time from
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

/**
 * Mock timer built-in copies to use actual global timer methods.
 *
 * The pause module captures timer references at module load time from
 * immutable-api-utils. This mock ensures jest.spyOn(global, 'setTimeout') captures
 * calls made through those references.
 */
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => globalThis.setTimeout(handler, timeout, ...args),
  clearTimeout: (id?: number) => globalThis.clearTimeout(id),
  setInterval: (handler: TimerHandler, timeout?: number, ...args: unknown[]) => globalThis.setInterval(handler, timeout, ...args),
  clearInterval: (id?: number) => globalThis.clearInterval(id),
}))

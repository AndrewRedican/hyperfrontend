/**
 * Safe copies of Console built-in methods.
 *
 * These references are captured at module initialization time to protect against
 * prototype pollution attacks. Import only what you need for tree-shaking.
 *
 * @module @hyperfrontend/immutable-api-utils/built-in-copy/console
 */

const _console = globalThis.console
const _freeze = globalThis.Object.freeze

/**
 * (Safe copy) Outputs a message to the console.
 */
export const log = _console.log.bind(_console)

/**
 * (Safe copy) Outputs a warning message to the console.
 */
export const warn = _console.warn.bind(_console)

/**
 * (Safe copy) Outputs an error message to the console.
 */
export const error = _console.error.bind(_console)

/**
 * (Safe copy) Outputs an informational message to the console.
 */
export const info = _console.info.bind(_console)

/**
 * (Safe copy) Outputs a debug message to the console.
 */
export const debug = _console.debug.bind(_console)

/**
 * (Safe copy) Outputs a stack trace to the console.
 */
export const trace = _console.trace.bind(_console)

/**
 * (Safe copy) Displays an interactive listing of the properties of a specified object.
 */
export const dir = _console.dir.bind(_console)

/**
 * (Safe copy) Displays tabular data as a table.
 */
export const table = _console.table.bind(_console)

/**
 * (Safe copy) Writes an error message to the console if the assertion is false.
 */
export const assert = _console.assert.bind(_console)

/**
 * (Safe copy) Clears the console.
 */
export const clear = _console.clear.bind(_console)

/**
 * (Safe copy) Logs the number of times that this particular call to count() has been called.
 */
export const count = _console.count.bind(_console)

/**
 * (Safe copy) Resets the counter used with console.count().
 */
export const countReset = _console.countReset.bind(_console)

/**
 * (Safe copy) Creates a new inline group in the console.
 */
export const group = _console.group.bind(_console)

/**
 * (Safe copy) Creates a new inline group in the console that is initially collapsed.
 */
export const groupCollapsed = _console.groupCollapsed.bind(_console)

/**
 * (Safe copy) Exits the current inline group.
 */
export const groupEnd = _console.groupEnd.bind(_console)

/**
 * (Safe copy) Starts a timer with a name specified as an input parameter.
 */
export const time = _console.time.bind(_console)

/**
 * (Safe copy) Stops a timer that was previously started.
 */
export const timeEnd = _console.timeEnd.bind(_console)

/**
 * (Safe copy) Logs the current value of a timer that was previously started.
 */
export const timeLog = _console.timeLog.bind(_console)

/**
 * (Safe copy) Namespace object containing all Console methods.
 * Note: Importing this imports all methods in this namespace (no tree-shaking).
 */
export const Console = _freeze({
  log,
  warn,
  error,
  info,
  debug,
  trace,
  dir,
  table,
  assert,
  clear,
  count,
  countReset,
  group,
  groupCollapsed,
  groupEnd,
  time,
  timeEnd,
  timeLog,
} as const)

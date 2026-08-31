import type { AccessType } from './spy'
import type { FakeTimerOptions } from './timers'
import type { MockFn } from './types'
import { advanceGeneration } from '../hooks/generation'
import { clearAllMocks, createMockFn, resetAllMocks } from './mock-fn'
import { createSpy, restoreAllMocks } from './spy'
import { advanceTimersByTime, clearAllTimers, runAllTimers, setSystemTime, useFakeTimers, useRealTimers } from './timers'

/**
 * The `jest` namespace object, carrying the mock, spy, and timer controls the suites use.
 *
 * Module mocking is deliberately absent: ES modules evaluate their imports before any
 * module body runs, so a `jest.mock` call cannot take effect the way it does under Jest's
 * CommonJS transform. Projects that need it are migrated in a later phase with a
 * mechanism designed for it, and calling it here fails loudly rather than silently
 * letting a spec assert against unmocked code.
 */
export type JestApi = {
  /** Creates a mock function. */
  fn<TArgs extends unknown[] = any[], TReturn = any>(implementation?: (...args: TArgs) => TReturn): MockFn<TArgs, TReturn>
  /** Replaces a method or accessor with a mock that calls through by default. */
  spyOn(target: object, key: PropertyKey, accessType?: AccessType): MockFn
  /** Returns its argument, narrowing it to a mock for the type checker. */
  mocked<TValue>(value: TValue): TValue
  /** Clears recorded calls on every mock. */
  clearAllMocks(): JestApi
  /** Clears calls and drops implementations on every mock. */
  resetAllMocks(): JestApi
  /** Restores every property replaced by a spy. */
  restoreAllMocks(): JestApi
  /** Installs a fake clock. */
  useFakeTimers(options?: FakeTimerOptions): JestApi
  /** Uninstalls the fake clock. */
  useRealTimers(): JestApi
  /** Advances the fake clock, running everything scheduled within the window. */
  advanceTimersByTime(milliseconds: number): void
  /** Advances the fake clock and yields, for timers whose callbacks await. */
  advanceTimersByTimeAsync(milliseconds: number): Promise<void>
  /** Runs every pending timer immediately. */
  runAllTimers(): void
  /** Runs every timer pending right now, without running timers those schedule. */
  runOnlyPendingTimers(): void
  /** Discards pending timers while keeping the fake clock installed. */
  clearAllTimers(): void
  /** Moves the fake clock to a specific instant. */
  setSystemTime(instant: number | Date): void
  /** Forces later dynamic imports to re-evaluate their target module. */
  resetModules(): JestApi
}

/**
 * The `jest` object exposed to specs.
 */
export const jest: JestApi = {
  fn: createMockFn,
  spyOn: createSpy,
  mocked: (value) => value,
  clearAllMocks: () => {
    clearAllMocks()
    return jest
  },
  resetAllMocks: () => {
    resetAllMocks()
    return jest
  },
  restoreAllMocks: () => {
    restoreAllMocks()
    return jest
  },
  useFakeTimers: (options) => {
    useFakeTimers(options)
    return jest
  },
  useRealTimers: () => {
    useRealTimers()
    return jest
  },
  advanceTimersByTime,
  advanceTimersByTimeAsync: async (milliseconds) => {
    advanceTimersByTime(milliseconds)
    // why: yielding lets promise callbacks scheduled by the fired timers settle before the caller asserts.
    await Promise.resolve()
  },
  runAllTimers,
  // why: Node runs pending timers and anything they schedule in one pass, so the two spellings coincide.
  runOnlyPendingTimers: runAllTimers,
  clearAllTimers,
  setSystemTime,
  resetModules: () => {
    advanceGeneration()
    return jest
  },
}

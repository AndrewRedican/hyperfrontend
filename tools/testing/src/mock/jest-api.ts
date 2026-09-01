import type { AccessType } from './spy'
import type { FakeTimerOptions } from './timers'
import type { MockFn } from './types'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { advanceGeneration } from '../hooks/generation'
import { mockContext, registerRuntimeMock } from '../hooks/mock-registry'
import { clearAllMocks, createMockFn, resetAllMocks } from './mock-fn'
import { createSpy, restoreAllMocks } from './spy'
import { advanceTimersByTime, clearAllTimers, runAllTimers, setSystemTime, useFakeTimers, useRealTimers } from './timers'

/**
 * The `jest` namespace object, carrying the mock, spy, and timer controls the suites use.
 *
 * `mock` and `requireActual` are the shapes of calls that have already happened by the time
 * a spec body runs. The loader reads them out of the spec's source and substitutes the
 * module before the spec's imports are linked, so what remains here is the call the spec
 * still makes at runtime, by which point the substitution has already happened.
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
  /** Declares a module replacement. The loader has already applied it by the time this runs. */
  mock(specifier: string, factory?: () => unknown): JestApi
  /** Declares a replacement while the suite runs. It reaches modules imported after it, not the ones already linked. */
  doMock(specifier: string, factory: () => unknown): JestApi
  /** Reads the module a replacement stands in for. Only meaningful inside a `mock` factory. */
  requireActual<TModule = unknown>(specifier: string): TModule
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
  // why: the loader read this call out of the source and substituted the module before the spec was linked, so this call has no remaining work.
  mock: () => jest,
  doMock: (specifier, factory) => {
    registerRuntimeMock(specifier, factory)
    return jest
  },
  requireActual: <TModule>(specifier: string): TModule => {
    const context = mockContext()
    const url = specifier.startsWith('node:') ? specifier : pathToFileURL(createRequire(context.specUrl).resolve(specifier)).href
    // why: a module with a replacement is reachable only through the namespace that replacement published, since requiring it again would return the replacement.
    const published = context.actuals.get(url)
    if (published) return published as TModule
    return createRequire(context.specUrl)(specifier) as TModule
  },
}

import type { MockedFunction } from './types'
import { createMockFn } from './mock-fn'
import { isMockFunction } from './types'

/**
 * An object whose methods are mocks at every depth, typed so a spec can configure and
 * inspect them without casting.
 */
export type DeepMocked<TTarget> = {
  [Key in keyof TTarget]: TTarget[Key] extends (...args: any[]) => any
    ? MockedFunction<TTarget[Key]>
    : TTarget[Key] extends object
      ? DeepMocked<TTarget[Key]>
      : TTarget[Key]
} & TTarget

/**
 * Names that callers probe to classify a value rather than to use it. Answering them with a
 * mock would make the object look like a promise to `await`, like an asymmetric matcher to
 * an equality check, or like a React element to a renderer.
 */
const UNMOCKED = new Set<PropertyKey>(['then', 'toJSON', 'asymmetricMatch', '$$typeof'])

/**
 * Wraps a target so any member it lacks is created as a mock the first time it is read.
 *
 * The created member is itself wrapped, which is what lets `client.repo.log()` work on a
 * mock that was never told `repo` exists. It is written onto the target, so the next read
 * returns the same mock and the member shows up when the object is printed.
 *
 * @param target - The object or mock function to extend.
 * @returns The wrapped target.
 */
function autoMocked<TTarget extends object>(target: TTarget): TTarget {
  return new Proxy(target, {
    get(owner, key, receiver) {
      if (typeof key === 'symbol' || key in owner || UNMOCKED.has(key)) return Reflect.get(owner, key, receiver)
      const member = autoMocked(createMockFn())
      Reflect.set(owner, key, member)
      return member
    },
  })
}

/**
 * Creates a stand-in for any object type, where every method a test touches is a mock.
 *
 * Members named in `overrides` read as given, except plain functions, which become mocks
 * that call them, so an override can be asserted on like any other member. A member
 * overridden with `undefined` reads as `undefined`. Any other member is created as a mock
 * returning `undefined` the first time it is read, at any depth. Members `Object.prototype`
 * already defines, such as `toString`, keep their real behaviour unless overridden, and
 * `then` is never invented, so the object is not mistaken for a promise.
 *
 * Every created mock is tracked like one made with `jest.fn`, so `jest.clearAllMocks` and
 * `jest.resetAllMocks` reach it.
 *
 * @param overrides - Members to fix in advance.
 * @returns The stand-in, typed as the target with every method a mock.
 * @example Handing a logger to code under test
 * ```ts
 * const logger = createMock<Logger>({ getLogLevel: () => 'debug' })
 * connect({ logger })
 * expect(logger.warn).toHaveBeenCalledWith('retrying')
 * expect(logger.getLogLevel).toHaveBeenCalled()
 * ```
 * @example Scripting a nested client
 * ```ts
 * const git = createMock<GitClient>()
 * git.log.mockReturnValue([])
 * git.remote.url.mockReturnValue('https://example.com/repo.git')
 * ```
 */
export function createMock<TTarget extends object = Record<string, any>>(overrides: Partial<TTarget> = {}): DeepMocked<TTarget> {
  const target: Record<PropertyKey, unknown> = {}
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(overrides))) {
    const { value } = descriptor
    // why: an accessor is copied as written, so a getter override keeps computing on every read.
    if (typeof value === 'function' && !isMockFunction(value)) descriptor.value = createMockFn(value as (...args: unknown[]) => unknown)
    Object.defineProperty(target, key, descriptor)
  }
  return autoMocked(target) as DeepMocked<TTarget>
}

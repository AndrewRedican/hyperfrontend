/**
 * Marks a function as created by this runtime's `jest.fn` or `jest.spyOn`, so matchers can
 * reject a plain function before reading call records off it.
 */
export const MOCK_MARKER = Symbol.for('hyperfrontend.testing.mockFunction')

/**
 * The outcome of a single mock invocation.
 */
export type MockResult<TReturn> = {
  /** Whether the call returned or threw. */
  type: 'return' | 'throw'
  /** The returned value, or the thrown error. */
  value: TReturn | unknown
}

/**
 * The recorded history of a mock, matching the shape Jest exposes as `fn.mock`.
 */
export type MockState<TArgs extends unknown[], TReturn> = {
  /** Arguments of every call, oldest first. */
  calls: TArgs[]
  /** Outcome of every call, aligned with `calls`. */
  results: MockResult<TReturn>[]
  /** The `this` value of every call, aligned with `calls`. */
  instances: unknown[]
  /** Arguments of the most recent call, or undefined when never called. */
  lastCall: TArgs | undefined
  /** A globally increasing sequence number per call, used to assert relative ordering. */
  invocationCallOrder: number[]
}

/**
 * A mock function with Jest's configuration and inspection surface.
 */
export type MockFn<TArgs extends unknown[] = any[], TReturn = any> = {
  (...args: TArgs): TReturn
  /** Discriminator identifying this as a mock. */
  [MOCK_MARKER]: true
  /** Recorded call history. */
  mock: MockState<TArgs, TReturn>
  /** Replaces the implementation used by every subsequent call. */
  mockImplementation(implementation?: (...args: TArgs) => TReturn): MockFn<TArgs, TReturn>
  /** Queues an implementation used by the next call only. */
  mockImplementationOnce(implementation: (...args: TArgs) => TReturn): MockFn<TArgs, TReturn>
  /** Returns the given value from every subsequent call. */
  mockReturnValue(value: TReturn): MockFn<TArgs, TReturn>
  /** Returns the given value from the next call only. */
  mockReturnValueOnce(value: TReturn): MockFn<TArgs, TReturn>
  /** Resolves to the given value from every subsequent call. */
  mockResolvedValue(value: unknown): MockFn<TArgs, TReturn>
  /** Resolves to the given value from the next call only. */
  mockResolvedValueOnce(value: unknown): MockFn<TArgs, TReturn>
  /** Rejects with the given reason from every subsequent call. */
  mockRejectedValue(reason: unknown): MockFn<TArgs, TReturn>
  /** Rejects with the given reason from the next call only. */
  mockRejectedValueOnce(reason: unknown): MockFn<TArgs, TReturn>
  /** Returns the call's `this` value from every subsequent call. */
  mockReturnThis(): MockFn<TArgs, TReturn>
  /** Labels the mock for failure output. */
  mockName(name: string): MockFn<TArgs, TReturn>
  /** Reads the label set by `mockName`. */
  getMockName(): string
  /** Clears recorded calls, keeping the implementation. */
  mockClear(): MockFn<TArgs, TReturn>
  /** Clears recorded calls and drops the implementation and any queued once-values. */
  mockReset(): MockFn<TArgs, TReturn>
  /** Restores the original property for a spy; equivalent to `mockReset` for a plain mock. */
  mockRestore(): MockFn<TArgs, TReturn>
}

/**
 * The spelling specs annotate mocks with. The parameters are ordered return-type first,
 * matching the `jest.Mock` the suites were written against, so replacing one with the
 * other is a rename rather than a re-typing.
 */
export type Mock<TReturn = any, TArgs extends any[] = any[]> = MockFn<TArgs, TReturn>

/**
 * A mock standing in for an existing function type, preserving its signature.
 */
export type MockedFunction<TFunction extends (...args: any[]) => any> = MockFn<Parameters<TFunction>, ReturnType<TFunction>> & TFunction

/**
 * An object whose function-valued properties have been replaced by mocks.
 */
export type Mocked<TTarget> = {
  [Key in keyof TTarget]: TTarget[Key] extends (...args: any[]) => any ? MockedFunction<TTarget[Key]> & TTarget[Key] : TTarget[Key]
} & TTarget

/**
 * Reports whether a value is a mock created by this runtime.
 *
 * @param value - The value to test.
 * @returns True when the value carries the mock marker.
 */
export function isMockFunction(value: unknown): value is MockFn {
  return typeof value === 'function' && (value as unknown as Record<symbol, unknown>)[MOCK_MARKER] === true
}

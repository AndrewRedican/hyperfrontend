import type { MockFn } from './types'

/**
 * Something that put a value in place and can take it away again.
 */
export type Restorable = {
  /** Puts the original back. */
  restore(): void
}

/**
 * Returns a set shared by every copy of this package loaded into the process.
 *
 * The preload and the main entry are bundled apart, so each carries its own copy of the
 * mock modules. A registered symbol on the global object is the one place both copies
 * reach, which is what lets a lifecycle hook installed by the preload clear the mocks a
 * spec created through the main entry. A module re-evaluated by `jest.resetModules` finds
 * the same set rather than starting an empty one.
 *
 * This module imports nothing at run time, because the preload loads it before the
 * resolution hooks that would resolve an extensionless specifier are installed.
 *
 * @param name - What the set holds, unique within this package.
 * @returns The set, created on first use.
 * @example Two lookups of one registry
 * ```ts
 * processRegistry<string>('example').add('a')
 * processRegistry<string>('example').has('a') // => true, from any copy of the package
 * ```
 */
export function processRegistry<TMember>(name: string): Set<TMember> {
  const key = Symbol.for(`hyperfrontend.testing.${name}`)
  return ((globalThis as Record<symbol, unknown>)[key] ??= new Set<TMember>()) as Set<TMember>
}

/**
 * Every mock created in this process, so the bulk helpers reach mocks the test never named.
 */
export const createdMocks = processRegistry<MockFn>('createdMocks')

/**
 * Every spy still holding a replaced property.
 */
export const installedSpies = processRegistry<MockFn>('installedSpies')

/**
 * Every property, environment variable and global replaced without a spy, in the order the
 * replacements were made.
 */
export const replacements = processRegistry<Restorable>('replacements')

/**
 * Clears recorded calls on every mock created in this process.
 *
 * @example Clearing call history while keeping implementations
 * ```ts
 * const fetchUser = createMockFn().mockReturnValue({ id: 1 })
 * fetchUser()
 * clearAllMocks()
 * fetchUser.mock.calls // => []
 * fetchUser() // => { id: 1 }, the implementation survives a clear
 * ```
 */
export function clearAllMocks(): void {
  for (const mock of createdMocks) mock.mockClear()
}

/**
 * Clears calls and drops implementations on every mock created in this process.
 *
 * @example Dropping implementations as well
 * ```ts
 * const fetchUser = createMockFn().mockReturnValue({ id: 1 })
 * resetAllMocks()
 * fetchUser() // => undefined
 * ```
 */
export function resetAllMocks(): void {
  for (const mock of createdMocks) mock.mockReset()
}

/**
 * Restores every property replaced by a spy in this process, then every property,
 * environment variable and global replaced without one.
 *
 * Replacements are undone newest first, so two replacements of one property leave the value
 * that was there before either.
 *
 * @example Putting every spied and replaced property back
 * ```ts
 * createSpy(console, 'warn').mockImplementation(() => undefined)
 * replaceProperty(process, 'platform', 'win32')
 * restoreAllMocks()
 * process.platform // => the real platform, and console.warn is the original again
 * ```
 */
export function restoreAllMocks(): void {
  for (const spy of [...installedSpies]) spy.mockRestore()
  for (const replacement of [...replacements].reverse()) replacement.restore()
}

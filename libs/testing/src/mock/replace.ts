import type { Restorable } from './registry'
import { replacements } from './registry'

/**
 * A property replaced by `jest.replaceProperty`, which can be given another value or put back.
 */
export type ReplacedProperty<TValue> = {
  /** Gives the property another value, keeping the original for restoration. */
  replaceValue(value: TValue): ReplacedProperty<TValue>
  /** Puts the original back. Restoring twice is a no-op. */
  restore(): void
}

/**
 * Records a replacement so `restoreAllMocks` can undo it, and hands back a restore that runs
 * at most once.
 *
 * @param undo - Puts the original back.
 * @returns The registered replacement.
 */
function track(undo: () => void): Restorable {
  const replacement: Restorable = {
    restore: () => {
      if (!replacements.delete(replacement)) return
      undo()
    },
  }
  replacements.add(replacement)
  return replacement
}

/**
 * Gives a property a value until it is restored, without spying on it.
 *
 * The property may be an own data property, an accessor, or one inherited from a
 * prototype: the replacement is always an own data property, so a prototype getter such as
 * jsdom's `navigator.userAgent` is shadowed rather than redefined. Restoring puts the own
 * descriptor back exactly, or removes the shadow when there was none.
 *
 * @param target - The object owning or inheriting the property.
 * @param key - The property to replace. It must already exist, as in Jest.
 * @param value - The value the property reads as until restored.
 * @returns A handle to change the value again or restore it.
 * @throws {TypeError} When the property does not exist, or is an own property that can be neither redefined nor written.
 * @example Pretending to run on Windows
 * ```ts
 * const platform = replaceProperty(process, 'platform', 'win32')
 * process.platform // => 'win32'
 * platform.restore()
 * process.platform // => the real platform
 * ```
 */
export function replaceProperty<TTarget extends object, TKey extends keyof TTarget>(
  target: TTarget,
  key: TKey,
  value: TTarget[TKey]
): ReplacedProperty<TTarget[TKey]> {
  if (!(key in target)) throw new TypeError(`Cannot replace ${String(key)}: the property does not exist on the target or its prototypes`)
  const own = Object.getOwnPropertyDescriptor(target, key)
  if (own && !own.configurable && !own.writable)
    throw new TypeError(`Cannot replace ${String(key)}: the property is neither configurable nor writable`)

  const assign = (next: TTarget[TKey]): void => {
    // why: a non-configurable property cannot be redefined, but one that is writable can still be assigned.
    if (own && !own.configurable) (target as Record<PropertyKey, unknown>)[key as PropertyKey] = next
    else Object.defineProperty(target, key, { value: next, writable: true, configurable: true, enumerable: own?.enumerable ?? true })
  }

  assign(value)
  const replacement = track(() => {
    if (own && !own.configurable) (target as Record<PropertyKey, unknown>)[key as PropertyKey] = own.value
    else if (own) Object.defineProperty(target, key, own)
    else delete (target as Record<PropertyKey, unknown>)[key as PropertyKey]
  })

  const handle: ReplacedProperty<TTarget[TKey]> = {
    replaceValue: (next) => {
      assign(next)
      return handle
    },
    restore: replacement.restore,
  }
  return handle
}

/**
 * Sets or removes an environment variable until it is restored.
 *
 * @param name - The variable to change.
 * @param value - Its value until restored, or `undefined` to remove it.
 * @example Running with a variable the surrounding shell may not have
 * ```ts
 * stubEnv('PORT', '6060')
 * stubEnv('CI', undefined)
 * process.env.PORT // => '6060'
 * restoreAllMocks()
 * process.env.PORT // => whatever the shell had, or undefined
 * ```
 */
export function stubEnv(name: string, value: string | undefined): void {
  const had = Object.hasOwn(process.env, name)
  const previous = process.env[name]
  const apply = (next: string | undefined): void => {
    if (next === undefined) delete process.env[name]
    else process.env[name] = next
  }
  apply(value)
  track(() => apply(had ? previous : undefined))
}

/**
 * Puts a value on the global object until it is restored, whether or not the global existed.
 *
 * @param name - The global to set.
 * @param value - Its value until restored.
 * @example Giving a suite a WebSocket the runtime lacks
 * ```ts
 * stubGlobal('WebSocket', FakeWebSocket)
 * new WebSocket('ws://localhost') // => a FakeWebSocket
 * restoreAllMocks()
 * ```
 */
export function stubGlobal(name: string, value: unknown): void {
  const own = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: own?.enumerable ?? false })
  track(() => {
    if (own) Object.defineProperty(globalThis, name, own)
    else delete (globalThis as Record<string, unknown>)[name]
  })
}

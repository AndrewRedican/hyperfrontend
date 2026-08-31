import type { UnknownClass, RegisteredIterableClassEntry, Config } from '../models'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isMarker } from '../is-marker'

export const registeredClasses: UnknownClass[] = []

export const registeredIterableClasses: RegisteredIterableClassEntry[] = [
  {
    classRef: Array,
    instantiate: () => [],
    getKeys: (target: unknown) => {
      const keysArray = keys(target as Iterable<string>)
      if (getConfig().detectCircularReferences) {
        return keysArray.filter((key) => !isMarker(key))
      }
      return keysArray
    },
    read: (target, key) => (target as Array<unknown>)[key as number],
    write: (target, value, key) => ((target as Array<unknown>)[key as number] = value),
    remove: (target, value) => (target as Array<unknown>).splice(value as number, 1),
  },
  {
    classRef: Object,
    instantiate: () => ({}),
    getKeys: (target: unknown) => {
      const keysArray = keys(target as Iterable<string>)
      if (getConfig().detectCircularReferences) {
        return keysArray.filter((key) => !isMarker(key))
      }
      return keysArray
    },
    read: (target, key) => (target as Record<string, unknown>)[key as string],
    write: (target, value, key) => ((target as Record<string, unknown>)[key as string] = value),
    remove: (target, value) => delete (target as Record<string, unknown>)[value as string],
  },
]

let samePositionOfOwnProperties = false

let detectCircularReferences = false

/**
 * Sets the global settings.
 *
 * @param config - Partial configuration object to merge with current settings
 *
 * @example Configuring settings
 * ```typescript
 * setConfig({ detectCircularReferences: true })
 * ```
 */
export const setConfig = (config: Partial<Config>): void => {
  samePositionOfOwnProperties =
    typeof config.samePositionOfOwnProperties === 'boolean' ? config.samePositionOfOwnProperties : samePositionOfOwnProperties || false
  detectCircularReferences =
    typeof config.detectCircularReferences === 'boolean' ? config.detectCircularReferences : detectCircularReferences || false
}

/**
 * Returns the global settings.
 *
 * @returns The current global configuration object
 *
 * @example Retrieving configuration
 * ```typescript
 * const { detectCircularReferences } = getConfig()
 * ```
 */
export const getConfig = (): Config => ({
  samePositionOfOwnProperties,
  detectCircularReferences,
})

import type { UnknownClass, RegisteredIterableClassEntry, Config } from '../models'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isMarker } from '../is-marker'

export const registeredClasses: UnknownClass[] = []

export const registeredIterableClasses: RegisteredIterableClassEntry[] = [
  {
    classRef: Array,
    instantiate: () => [],
    getKeys: (target: unknown) => {
      const keysArray = keys(<Iterable<string>>target)
      if (getConfig().detectCircularReferences) {
        return keysArray.filter((key) => !isMarker(key))
      }
      return keysArray
    },
    read: (target, key) => (<Array<unknown>>target)[<number>key],
    write: (target, value, key) => ((<Array<unknown>>target)[<number>key] = value),
    remove: (target, value) => (<Array<unknown>>target).splice(<number>value, 1),
  },
  {
    classRef: Object,
    instantiate: () => ({}),
    getKeys: (target: unknown) => {
      const keysArray = keys(<Iterable<string>>target)
      if (getConfig().detectCircularReferences) {
        return keysArray.filter((key) => !isMarker(key))
      }
      return keysArray
    },
    read: (target, key) => (<Record<string, unknown>>target)[<string>key],
    write: (target, value, key) => ((<Record<string, unknown>>target)[<string>key] = value),
    remove: (target, value) => delete (<Record<string, unknown>>target)[<string>value],
  },
]

let samePositionOfOwnProperties = false

let detectCircularReferences = false

/**
 * Sets the global settings.
 *
 * @param config - Partial configuration object to merge with current settings
 *
 * @example
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
 * @example
 * ```typescript
 * const { detectCircularReferences } = getConfig()
 * ```
 */
export const getConfig = (): Config => ({
  samePositionOfOwnProperties,
  detectCircularReferences,
})

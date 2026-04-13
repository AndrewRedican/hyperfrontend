/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Retrieves the final key from a Map by converting keys to an array.
 *
 * @param map - The Map to extract the last key from
 * @returns The key that was inserted last, or undefined if map is empty
 * @example Getting last key from Map
 * ```typescript
 * const userRoles = new Map<string, string>()
 * userRoles.set('alice', 'admin')
 * userRoles.set('bob', 'editor')
 * userRoles.set('charlie', 'viewer')
 *
 * getLastKeyInMap(userRoles) // => 'charlie'
 * ```
 */
export const getLastKeyInMap = <K = any>(map: Map<K, any>): K => {
  const items = [...map.keys()]
  return <K>items[items.length - 1]
}

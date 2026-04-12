import type { Logger } from '@hyperfrontend/logging'
import type { DeepReadonly, DeepFreezeConfig } from './model'
import { isIterable } from '@hyperfrontend/data-utils'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { collectNodesToFreeze } from './collect-nodes-to-freeze'

/**
 * Deeply freezes an object and all nested objects/arrays within it.
 * Freezes from the deepest leaf nodes first, working upwards to ensure
 * proper immutability at all levels.
 *
 * Uses WeakSet-based circular reference detection that safely handles
 * mixed structures containing both frozen and unfrozen objects.
 *
 * @template T - The type of value to freeze
 * @param value - The object or array to deep freeze
 * @param logger - Logger for error reporting
 * @param config - Optional configuration for traversal behavior
 * @returns The same value, now frozen at all levels (where possible)
 *
 * @remarks
 * - Gracefully handles circular references without infinite loops
 * - Works with mixed frozen/unfrozen nested structures
 * - Nodes that fail to freeze are logged but don't halt the operation
 * - Has a default depth limit of 100 to prevent stack overflow on pathological structures
 *
 * @example Deep freezing configuration
 * ```typescript
 * const config = {
 *   name: 'app',
 *   settings: {
 *     debug: true,
 *     options: ['a', 'b']
 *   }
 * }
 *
 * const frozen = deepFreeze(config, logger)
 *
 * frozen.name = 'x'                 // TypeError (frozen)
 * frozen.settings.debug = false     // TypeError (frozen)
 * frozen.settings.options.push('c') // TypeError (frozen)
 * ```
 */
export function deepFreeze<T>(value: T, logger: Logger, config?: DeepFreezeConfig): DeepReadonly<T> {
  if (!isIterable(value)) return <DeepReadonly<T>>value

  try {
    const nodesToFreeze = collectNodesToFreeze(value, config)
    for (const node of nodesToFreeze) {
      try {
        freeze(node.value)
      } catch (error) {
        logger.debug('Failed to freeze node at depth', node.depth, error)
      }
    }
  } catch (error) {
    logger.debug('Failed to traverse object for deep freeze', error)
  }

  return <DeepReadonly<T>>value
}

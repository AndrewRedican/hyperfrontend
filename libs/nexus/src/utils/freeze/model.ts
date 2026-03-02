/**
 * Node information for tracking freeze order by depth.
 */
export interface FreezeNode {
  /** The iterable data structure to freeze */
  value: object
  /** Depth in the object tree (0 = root) */
  depth: number
}

/**
 * Configuration options for deep freeze traversal.
 */
export interface DeepFreezeConfig {
  /**
   * Maximum depth to traverse. Prevents stack overflow on extremely deep structures.
   * Use Infinity for unlimited depth (default: 100).
   */
  maxDepth?: number
}

/**
 * Recursively makes all properties of T readonly.
 * Handles objects, arrays, Maps, Sets, and nested structures.
 *
 * @returns A new type with all properties of T recursively marked as readonly
 *
 * @example
 * ```typescript
 * interface Config {
 *   name: string
 *   settings: {
 *     debug: boolean
 *     options: string[]
 *   }
 * }
 *
 * type FrozenConfig = DeepReadonly<Config>
 * // Result:
 * // {
 * //   readonly name: string
 * //   readonly settings: {
 * //     readonly debug: boolean
 * //     readonly options: readonly string[]
 * //   }
 * // }
 * ```
 */
export type DeepReadonly<T> = T extends (...args: unknown[]) => unknown
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends Set<infer U>
      ? ReadonlySet<DeepReadonly<U>>
      : T extends ReadonlyArray<infer U>
        ? ReadonlyArray<DeepReadonly<U>>
        : T extends object
          ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
          : T

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Function that tests if a value matches a condition */
export type Predicate = (x: unknown) => boolean

/** JavaScript data type names including 'null' and 'array' */
export type DataType = 'undefined' | 'object' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol' | 'function' | 'null' | 'array'

/** Any iterable of unknown values */
export type UnknownIterable = Iterable<unknown>

/** String keys of UnknownIterable */
export type UnknownIterableKey = keyof UnknownIterable & string

/** Constructor type for unknown class instances */
export type UnknownClass<T = unknown> = {
  new (...args: any[]): T
}

/** Registered iterable class with operators for traversal */
export interface RegisteredIterableClassEntry<T = unknown> {
  /** A reference to a class definition. */
  classRef: UnknownClass<T>

  /** Returns a new (empty) instance. */
  instantiate: () => T

  /** Returns list of iterable keys. */
  getKeys: (target: any) => string[]

  /** Returns a value corresponding to a key of class instance. */
  read: (target: any, key: unknown) => unknown

  /** Sets a new value with specific key optionally on class instance. */
  write: (instance: T, value: unknown, key?: unknown) => void

  /** Removes a key from the class instance. */
  remove: (instance: T, key: unknown) => void
}

/** Operators for iterating over custom class instances */
export interface IterableOperators<T = unknown> {
  /** Returns a new (empty) instance. */
  instantiate: () => T

  /** Returns list of iterable keys. */
  getKeys: (target: any) => string[]

  /** Returns a value corresponding to a key of class instance. */
  read: (target: any, key: unknown) => unknown

  /** Sets a new value with specific key optionally on class instance. */
  write: (instance: T, value: unknown, key?: unknown) => void

  /** Removes a key from the class instance. */
  remove: (instance: T, key: unknown) => void
}

/** Configuration options for comparison and traversal */
export interface Config {
  /**
   * A flag that indicates the API that two values can match only if their properties
   * are in the same order when set to `true`
   */
  samePositionOfOwnProperties: boolean

  /**
   * A flag that indicates the API that circular references may exist and should keep a tally of reference stack.
   * Turning this flag ON comes at a performance cost, so enable only when necessary.
   */
  detectCircularReferences: boolean
}

/** Stack for tracking object references during traversal */
export interface ReferenceStack {
  /**
   * Total number of references in the stack.
   */
  size: number

  /**
   * Returns true if reference is already registered.
   *
   * @param reference
   * @returns
   */
  exists: (reference: unknown) => boolean

  /**
   * Returns a negative number corresponding to how many iterations ago the reference
   * was registered in the stack relative to the last entry or null when it is not in the stack.
   *
   * @param reference
   * @returns
   */
  lastSeen: (reference: unknown) => number | null

  /**
   * Adds a new reference into the stack.
   */
  add: (reference: unknown) => void

  /**
   * Empties the reference stack and removes any flags added.
   */
  clear: () => void
}

/** Configuration specifying traversal depth range */
export interface DepthConfig {
  /** Depth range: [min, max] or [min] or empty */
  depth: [number, number | '*'] | [number] | []
}

/** Internal traversal configuration */
export interface TraverseConfig {
  /** Depth range with resolved max value */
  depth: [number, number | '*']
  /** Whether to exit traversal early */
  exitEarly: boolean
}

/** Condition function to determine if a node should be processed */
export type Condition = (config: TraverseConfig, key: string, value: unknown, path: string[], parent: unknown) => boolean

/** Callback function invoked for each traversed node */
export type Callback = (key: string, value: unknown, path: string[], state: any, parent: unknown) => void

/** Arguments tuple for traversal functions */
export type TraversalArgs<T = unknown, S extends Record<string, unknown> = Record<string, unknown>> = [
  Condition,
  Callback,
  TraverseConfig,
  string,
  string[],
  T,
  unknown,
  S,
]

/** Traversal function for non-circular structures */
export type TraversalNonCircular<S extends Record<string, unknown> = Record<string, unknown>> = (
  condition: Condition,
  callback: Callback,
  config: TraverseConfig,
  key: string,
  path: string[],
  value: unknown,
  parent: unknown,
  state: S
) => S

/** Traversal function for structures with circular references */
export type TraversalCircular = (
  condition: Condition,
  callback: Callback,
  config: TraverseConfig,
  key: string,
  path: string[],
  value: unknown,
  parent: unknown,
  state: any,
  stack: ReferenceStack,
  root?: boolean
) => any

/** Generic traversal function */
export type Traversal<T = unknown> = (target: T, condition: Condition, callback: Callback, options: DepthConfig, state: any) => any

/** Factory function that creates a traverse function with a fixed condition */
export type TraversalCreator<T = unknown> = (condition: Condition) => Traverse<T>

/** Function to traverse a target with callback and options */
export type Traverse<T = unknown> = (target: T, callback: Callback, options?: DepthConfig, state?: any) => any

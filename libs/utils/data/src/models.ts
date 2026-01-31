/* eslint-disable @typescript-eslint/no-explicit-any */

export type Predicate = (x: unknown) => boolean

export type DataType = 'undefined' | 'object' | 'boolean' | 'number' | 'bigint' | 'string' | 'symbol' | 'function' | 'null' | 'array'

export type UnknownIterable = Iterable<unknown>

export type UnknownIterableKey = keyof UnknownIterable & string

export type UnknownClass<T = unknown> = {
  new (...args: any[]): T
}

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

export interface Options {
  depth: [number, number | '*'] | [number] | []
}

export interface TraverseConfig {
  depth: [number, number | '*']
  exitEarly: boolean
}

export type Condition = (config: TraverseConfig, key: string, value: unknown, path: string[], parent: unknown) => boolean

export type Callback = (key: string, value: unknown, path: string[], state: any, parent: unknown) => void

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

export type Traversal<T = unknown> = (target: T, condition: Condition, callback: Callback, options: Options, state: any) => any

export type TraversalCreator<T = unknown> = (condition: Condition) => Traversal<T>

export type Traverse<T = unknown> = (target: T, callback: Callback, options?: Options, state?: any) => any

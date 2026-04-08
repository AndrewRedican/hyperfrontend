import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Represents the location where a circular reference was detected.
 */
export interface Location {
  /** Path segments from root to the location */
  path: [string, ...string[]]
}

/**
 * Represents the target of a circular reference.
 */
export interface Target {
  /** Path segments from root to the target */
  path: string[]
}

/**
 * Describes a circular reference in an object graph.
 */
export interface ICircularReference {
  /** Location where the circular reference was detected */
  readonly location: Location
  /** Target of the circular reference */
  readonly target: Target
  /** Depth of the circular reference */
  readonly depth: number
}

/**
 * Represents a detected circular reference in an object graph.
 * Tracks the location where the reference was found and its target.
 *
 * @example
 * ```typescript
 * const ref = new CircularReference(['root', 'child'], ['root'])
 * console.log(ref.depth) // 1
 * ```
 */
export class CircularReference implements ICircularReference {
  public readonly location: Location
  public readonly target: Target
  public readonly keyDelimiter = '\u00B7'
  private readonly delimiter = ' \u2192 '

  constructor(location: Location['path'], target: Target['path']) {
    if (!isArray(location) || location.length === 0) {
      throw createError(`Expected location to be a list with at list one string value.`)
    }
    if (!isArray(target)) {
      throw createError(`Expected target to be a list.`)
    }
    this.location = { path: location }
    this.target = { path: target }
  }

  get depth(): number {
    return this.location.path.length - this.target.path.length
  }

  public readonly toString = (): string => `${this.join(this.location)}${this.delimiter}${this.join(this.target)}`

  public readonly toJSON = (): string => this.toString()

  private readonly join = ({ path }: Location | Target): string => path.join(this.keyDelimiter)
}

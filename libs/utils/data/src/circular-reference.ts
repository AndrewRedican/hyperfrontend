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
 * @example Creating a circular reference instance
 * ```typescript
 * const ref = new CircularReference(['root', 'child'], ['root'])
 * console.log(ref.depth) // 1
 * ```
 */
export class CircularReference implements ICircularReference {
  /** Where in the object graph the reference was found, as the path from the root. */
  public readonly location: Location
  /** What the reference points back to, as the path from the root; empty when that is the root itself. */
  public readonly target: Target
  /** Separator placed between path segments when a path is rendered as text. */
  public readonly keyDelimiter = '\u00B7'
  private readonly delimiter = ' \u2192 '

  /**
   * Records a circular reference by the two paths that describe it.
   *
   * @param location - Path from the root to where the reference was found; needs at least one segment
   * @param target - Path from the root to the value the reference points back to
   * @throws {Error} When `location` is empty or either argument is not a list
   */
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

  /**
   * How far the location sits beneath the target it points back to.
   *
   * @returns The difference in path length, so a value pointing at its own parent reads as 1
   */
  get depth(): number {
    return this.location.path.length - this.target.path.length
  }

  /**
   * Renders the reference as `location → target`, each path joined with `keyDelimiter`.
   *
   * @returns The reference as one line of text
   */
  public readonly toString = (): string => `${this.join(this.location)}${this.delimiter}${this.join(this.target)}`

  /**
   * Serializes the reference for `JSON.stringify`, which calls this in place of the object.
   *
   * @returns The same text `toString` produces
   */
  public readonly toJSON = (): string => this.toString()

  private readonly join = ({ path }: Location | Target): string => path.join(this.keyDelimiter)
}

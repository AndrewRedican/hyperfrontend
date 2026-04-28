import type { DataType } from './models'

/** Predicate function to determine if a data point should be included/excluded */
export type SelectiveCopyPredicate = <T extends DataType = DataType>(target: unknown, path: string[], key: string, dataType: T) => boolean

/** Operation function applied to each data point during traversal */
export type DataPointOperation = <T extends DataType = DataType>(target: unknown, path: string[], key: string, dataType: T) => void

/**
 * Settings used to determine what to copy.
 */
export interface SelectiveCopyOptions {
  /** Set flag true to ignore all functions. */
  skipFunctions?: boolean
  /** A list of top-level properties that should be included. */
  includeKeys?: string[]
  /** A list of top-level properties that should be excluded. */
  excludeKeys?: string[]
  /** A condition that is evaluated to determine if data point should be included. */
  include?: SelectiveCopyPredicate
  /** A condition that is evaluated to determine if data point should be excluded. */
  exclude?: SelectiveCopyPredicate
}

/**
 * Represents a single data point in an object graph.
 */
export interface DataPoint {
  /** The value at this data point */
  target: unknown
  /** Path segments from root to this point */
  path: string[]
  /** Property key at this point */
  key: string
  /** Type of the data at this point */
  dataType: DataType
}

/**
 * Describes a reference loop detected during traversal.
 */
export interface ReferenceLoop {
  /** Path where the loop starts */
  startPath: string[]
  /** Path where the loop leads to */
  destinationPath: string[]
}

/**
 * Result of {@link selectiveCopy}: the partial clone and any skipped data points.
 *
 * @template T - Original target type
 */
export interface SelectiveCopyResult<T> {
  /** Cloned value */
  clone: Partial<T>
  /** Skipped data points */
  skipped: DataPoint[]
}

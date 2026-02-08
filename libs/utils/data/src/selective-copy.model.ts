import type { DataType } from './models'

export type SelectiveCopyPredicate = <T extends DataType = DataType>(target: unknown, path: string[], key: string, dataType: T) => boolean

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

export interface DataPoint {
  target: unknown
  path: string[]
  key: string
  dataType: DataType
}

export interface ReferenceLoop {
  startPath: string[]
  destinationPath: string[]
}

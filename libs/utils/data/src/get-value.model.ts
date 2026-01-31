/**
 * Options for providing default values when retrieving data.
 */
export interface DefaultValueOptions<T = unknown> {
  /** Default value to return when a key in the path is missing. */
  onMissingKey?: T
  /** Default value to return when an error occurs during retrieval. */
  onError?: T
}

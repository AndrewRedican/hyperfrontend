/** A line of source drawn as a chip under the step it happens at. */
export interface WindowCall {
  /** The source, set in the mono face. */
  code: string
  /** The one word under the chip, if the chip needs one. */
  lead?: string
}

/** Everything a scene tells the window stage. */
export interface WindowConfig {
  /** The four steps' names, in the order the module passes through them. */
  stations: readonly [string, string, string, string]
  /** The call as the load hook reads it from source, under the first step. */
  read: WindowCall
  /** What the second step does with what was read, under the second step. */
  substitute: WindowCall
  /** The same call as it executes, under the last step. */
  run: WindowCall
}

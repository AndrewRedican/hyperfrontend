/** One station on the loop: who acts there and what they do. */
export interface LoopStation {
  /** The small capitals over the title, naming who acts: the human or the model. */
  who: string
  /** What happens at this station. */
  title: string
  /** The line under the title. */
  note: string
}

/** Everything a scene tells the loop stage. */
export interface LoopConfig {
  /** The small capitals across the top of the figure, stating the thesis. */
  caption: string
  /** The station where the problem is defined. */
  define: LoopStation
  /** The station where the model implements and proposes. */
  propose: LoopStation
  /** The station where the human reviews. */
  review: LoopStation
  /** The small capitals over the rails. */
  railsCaption: string
  /** The checks a change must pass, top to bottom. */
  rails: readonly string[]
  /** The label of the rail an accepted change becomes. */
  nextRail: string
  /** The line along the return path, saying what accepted changes turn into. */
  feedback: string
}

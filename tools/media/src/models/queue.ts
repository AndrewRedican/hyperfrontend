import type { Mark } from './banner'

/** The package factory one container stands for. */
export interface QueueApi {
  /** The function name, as a reader would import it. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/**
 * Everything a scene tells the queue stage.
 *
 * Two containers are loaded with the same objects at the same moments and
 * then pulled at the same moments, so the only thing that can explain the two
 * different exit rows is which factory made the list. The objects are numbered
 * from 1 in the order they are pushed; the numbers are the whole of their
 * identity.
 *
 * Pulls should be spaced at least 600 ms apart: a pull takes the disc at the
 * mouth of the tube, and the discs above it need that long to settle down
 * into its place before the next pull reads the right one.
 */
export interface QueueConfig {
  /** The factory whose list hands objects back oldest first: drawn as a tube open at both ends. */
  fifo: QueueApi
  /** The factory whose list hands objects back newest first: drawn as a cup open only at the top. */
  lifo: QueueApi
  /** When each object is pushed, in the order pushed; both lists take the same object at the same moment. */
  pushAtMs: readonly number[]
  /** When each pull happens, in order; both lists are pulled at the same moment and answer differently. */
  pullAtMs: readonly number[]
  /** How long the frame holds after the exit rows have been marked complete. */
  restMs?: number
}

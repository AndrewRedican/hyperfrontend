/**
 * State selectors for querying async process states like in-progress, done, failed, and paused.
 *
 * @module @hyperfrontend/state-machine/selectors
 */
export {
  notStarted,
  inProgress,
  done,
  successful,
  failed,
  retrying,
  restarting,
  halted,
  paused,
  cancelled,
  derivedState,
} from './selectors'

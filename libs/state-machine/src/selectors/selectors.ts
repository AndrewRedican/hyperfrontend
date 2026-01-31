import type { StateStatusDeriver, StateDeriver } from '../models'

export const notStarted: StateStatusDeriver = (state) => !state.inProgress && !state.success && !state.fail

export const inProgress: StateStatusDeriver = (state) => state.inProgress

export const done: StateStatusDeriver = (state) => !state.inProgress && (state.success || state.fail)

export const successful: StateStatusDeriver = (state) => !state.inProgress && state.success && !state.fail

export const failed: StateStatusDeriver = (state) => !state.inProgress && !state.success && state.fail

export const retrying: StateStatusDeriver = (state) => state.inProgress && !state.success && state.fail

export const restarting: StateStatusDeriver = (state) => state.inProgress && state.success && !state.fail

export const halted: StateStatusDeriver = (state) => state.halt

export const paused: StateStatusDeriver = (state) => state.inProgress && state.halt

export const cancelled: StateStatusDeriver = (state) => !state.inProgress && state.halt && !state.success && !state.fail

export const derivedState: StateDeriver = (state) => ({
  notStarted: notStarted(state),
  inProgress: inProgress(state),
  done: done(state),
  successful: successful(state),
  failed: failed(state),
  retrying: retrying(state),
  restarting: restarting(state),
  halted: halted(state),
  paused: paused(state),
  cancelled: cancelled(state),
})

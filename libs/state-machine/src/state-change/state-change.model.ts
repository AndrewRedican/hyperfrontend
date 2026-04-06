import { DerivedState } from '../models'

/** A snapshot of the current state, or null if no state exists. */
export type StateSnapshot = DerivedState | null

/** A tuple of previous and current state snapshots. */
export type States = [StateSnapshot, StateSnapshot]

/** Handler function invoked when state changes. */
export type StateChangeHandler = (previous: StateSnapshot, current: StateSnapshot) => void

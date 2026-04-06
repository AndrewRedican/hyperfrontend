import type { Event, DerivedState } from '../models'

/** Function that selects whether a data point matches criteria based on state */
export type DataPointSelector = (state: DerivedState) => boolean

/** Handler function invoked when an event occurs with current and previous state */
export type EventHandler = (event: Event, current: DerivedState, previous: DerivedState) => void

import type { Event, DerivedState } from '../models'

export type DataPointSelector = (state: DerivedState) => boolean

export type EventHandler = (event: Event, current: DerivedState, previous: DerivedState) => void

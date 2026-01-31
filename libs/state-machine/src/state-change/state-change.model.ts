import { DerivedState } from '../models'

export type StateSnapshot = DerivedState | null

export type States = [StateSnapshot, StateSnapshot]

export type StateChangeHandler = (previous: StateSnapshot, current: StateSnapshot) => void

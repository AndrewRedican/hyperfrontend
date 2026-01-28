import type { State, Action } from '../models'

export type Listener = (state: State, action: Action) => void

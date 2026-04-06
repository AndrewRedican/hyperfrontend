import type { State, Action } from '../models'

/** State change listener callback type. */
export type Listener = (state: State, action: Action) => void

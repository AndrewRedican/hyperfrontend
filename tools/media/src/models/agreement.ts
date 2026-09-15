import type { Mark } from './banner'

/** One property of an approach, as a row under its pane. */
export interface AgreementTrait {
  /** What the row is about. */
  label: string
  /** Where this approach stands on it. */
  value: string
}

/** One of the two approaches, drawn as a pane. */
export interface AgreementSide {
  /** The small capitals over the pane. */
  caption: string
  /** The line under the caption. */
  note: string
  /** What the slab under the applications says, for the cohesion side; what the walls stand for, for the isolation side. */
  ground: string
  /** The rows under the pane, top to bottom. */
  traits: readonly AgreementTrait[]
}

/** Everything a scene tells the agreement stage. */
export interface AgreementConfig {
  /** The approach that starts from shared assumptions. */
  cohesion: AgreementSide
  /** The approach that starts from isolation. */
  isolation: AgreementSide
  /** How many applications each pane draws. */
  applications: number
  /** What the left end of the axis reads. */
  axisLeft: string
  /** What the right end of the axis reads. */
  axisRight: string
  /** The name beside the marker on the axis. */
  marker: string
  /** The mark drawn as the marker. */
  mark: Mark
  /** The line along the foot of the figure. */
  caption: string
}

import type { Protocol } from '../../channel/model'

/**
 * Result object mapping each protocol property to its validation status.
 */
export type ValidProtocolResult = {
  [Property in keyof Protocol]: boolean | void
}

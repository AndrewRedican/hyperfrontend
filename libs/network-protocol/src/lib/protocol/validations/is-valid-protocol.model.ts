import type { Protocol } from '../../channel/model'

export type ValidProtocolResult = {
  [Property in keyof Protocol]: boolean | void
}

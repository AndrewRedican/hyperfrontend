import type { Mark } from './banner'
import type { ThemeTones } from './theme'

/** The outline a slot is cut in and a token is cast in. */
export type PortShape = 'triangle' | 'circle' | 'diamond'

/** The tone a token is drawn in: one of the theme's meanings. */
export type PortTone = keyof ThemeTones

/** Which of the two brokers something belongs to, or sets off from. */
export type PortSide = 'left' | 'right'

/** One message type a contract names, and the shape every token and slot of that type takes. */
export interface PortType {
  /** The type name, as the contract states it. */
  type: string
  /** The outline tokens of this type are cast in, and slots for it are cut in. */
  shape: PortShape
  /** The tone tokens of this type are drawn in. */
  tone: PortTone
}

/** One broker. */
export interface PortNode {
  /** The broker's name, set at the top of its card. */
  label: string
  /** The package call this broker stands for, set as a chip under its name. */
  api: string
  /** The types this broker's own contract accepts: a slot is cut into its inner edge for each. */
  accepts: readonly string[]
}

/** One pulse of the handshake. */
export interface PortPulse {
  /** The side it sets off from. */
  from: PortSide
  /** When it sets off. */
  atMs: number
}

/** One message sent once the wire is open. */
export interface PortMessage {
  /** The side it sets off from. */
  from: PortSide
  /** Its type, which decides its shape and whether the far side has a slot for it. */
  type: string
  /** When it sets off. */
  atMs: number
}

/** Everything a scene tells the ports stage. */
export interface PortsConfig {
  /** The package's mark, drawn on both API chips. */
  mark: Mark
  /** The broker on the left. */
  left: PortNode
  /** The broker on the right. */
  right: PortNode
  /** Every message type either contract names, with its shape and tone. */
  types: readonly PortType[]
  /** The handshake, in order; the wire opens when the last pulse arrives. */
  pulses: readonly PortPulse[]
  /** How long a handshake pulse takes to cross the wire. */
  pulseMs: number
  /** The messages sent once the wire is open, in order. */
  messages: readonly PortMessage[]
  /** How long a token takes to cross the wire. */
  crossMs: number
  /** How long the frame holds after the last message has settled. */
  restMs?: number
}

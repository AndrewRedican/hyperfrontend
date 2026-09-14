import type { PortMessage, PortsConfig, PortSide } from '../models/ports'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a token takes to grow out of the node that sends it. */
export const POP_MS = 220

/** How long a token that fits takes to slide from where it waits into its slot. */
export const SEAT_MS = 300

/** How long a slot and its node glow once a token is seated. */
export const GLOW_MS = 900

/** How long a token with no slot waits at the boundary before it falls. */
export const HALT_MS = 200

/** How long a token with no slot takes to fall and fade. */
export const FALL_MS = 600

/** How long after a token starts falling the mark it leaves starts to show: once the token has finished dissolving. */
export const MARK_DELAY_MS = 600

/** How long the mark takes to show. */
export const MARK_MS = 400

/** How long both nodes flash when the wire opens. */
export const FLASH_MS = 900

/** How long the open wire takes to light from the middle out to both ends. */
export const SWEEP_MS = 400

/** How long a node ticks when a handshake pulse reaches it. */
export const TICK_MS = 450

/** One pulse of the handshake, resolved to when it sets off and when it lands. */
export interface PulseMoment {
  /** The side it sets off from. */
  from: PortSide
  /** When it leaves the sender's edge. */
  setOffAt: number
  /** When it reaches the receiver's edge. */
  arriveAt: number
}

/** One message, resolved to the moments it passes through. */
export interface MessageMoment {
  /** The message as the scene configured it. */
  message: PortMessage
  /** Whether the receiver's own contract accepts this type, which is whether it has a slot for it. */
  fits: boolean
  /** When the token starts growing out of the sender. */
  popAt: number
  /** When it sets off across the wire. */
  crossAt: number
  /** When it reaches the receiver's boundary. */
  arriveAt: number
  /** When nothing about it is moving any more. */
  doneAt: number
}

/** Every moment on the stage's timeline. */
export interface PortsTimeline {
  /** The handshake pulses, in order. */
  pulses: readonly PulseMoment[]
  /** When the last pulse lands and the wire opens. */
  openAt: number
  /** The messages, in order. */
  messages: readonly MessageMoment[]
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * The side a message sent from one side lands on.
 *
 * @param from - The side it set off from.
 * @returns The side opposite the one given.
 * @example Where a message from the left lands
 * ```ts
 * otherSide('left') // 'right'
 * ```
 */
export function otherSide(from: PortSide): PortSide {
  return from === 'left' ? 'right' : 'left'
}

/**
 * Whether a message will be let in.
 *
 * Decided by the receiver's own contract, never the sender's: a type the
 * sender is free to emit still has nowhere to go unless the receiver cut a
 * slot for it.
 *
 * @param config - The brokers as the scene configured them.
 * @param message - The message being sent.
 * @returns Whether the receiver accepts the message's type.
 * @example A type the receiver never accepted
 * ```ts
 * messageFits(config, { from: 'right', type: 'PRICE_SYNC', atMs: 0 }) // false
 * ```
 */
export function messageFits(config: PortsConfig, message: PortMessage): boolean {
  const receiver = otherSide(message.from) === 'left' ? config.left : config.right
  return receiver.accepts.includes(message.type)
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * @param config - The brokers, the handshake and the messages as the scene configured them.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * portsTimeline(config).settledAt
 * ```
 */
export function portsTimeline(config: PortsConfig): PortsTimeline {
  const pulses = config.pulses.map((pulse) => ({ from: pulse.from, setOffAt: pulse.atMs, arriveAt: pulse.atMs + config.pulseMs }))
  const openAt = pulses.reduce((latest, pulse) => max(latest, pulse.arriveAt), 0)
  const messages = config.messages.map((message) => {
    const fits = messageFits(config, message)
    const crossAt = message.atMs + POP_MS
    const arriveAt = crossAt + config.crossMs
    const doneAt = fits ? arriveAt + SEAT_MS + GLOW_MS : arriveAt + HALT_MS + MARK_DELAY_MS + MARK_MS
    return { message, fits, popAt: message.atMs, crossAt, arriveAt, doneAt }
  })
  const settledAt = messages.reduce((latest, moment) => max(latest, moment.doneAt), openAt + FLASH_MS)
  return { pulses, openAt, messages, settledAt }
}

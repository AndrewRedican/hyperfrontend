import type { ComposeConfig, ComposeMessage } from '../models/compose'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, progress, pulse } from '../lib/motion'

/** How long a feature takes to slide into its slot unless the scene says otherwise. */
export const DEFAULT_DOCK_MS = 1200

/** How long a wire takes to draw itself from the hub to a seated feature. */
export const WIRE_MS = 500

/** How long a seated feature's outline flashes. */
export const FLASH_MS = 700

/** How long a message takes to cross a wire. */
export const FLIGHT_MS = 900

/** How long an end of a wire glows after a message lands. */
export const GLOW_MS = 600

/** One feature at one instant. */
export interface FeatureState {
  /** Eased progress from its origin into its slot, 1 when seated. */
  seat: number
  /** Intensity of the outline flash that greets it once seated. */
  flash: number
  /** How much of its wire has been drawn, from 0 to 1. */
  wire: number
  /** Glow at its end of the wire, from a message that just landed. */
  glow: number
}

/** A message part way across its wire. */
export interface DotState {
  /** The crossing. */
  message: ComposeMessage
  /** Eased progress from departure to arrival. */
  t: number
}

/** Everything the renderer draws at one instant. */
export interface ComposeState {
  /** Each feature, index for index with the scene's list. */
  features: readonly FeatureState[]
  /** Every message in flight. */
  dots: readonly DotState[]
  /** Glow at the hub, from a message that just landed there. */
  hubGlow: number
  /** Whether at least one wire is live. */
  hubLive: boolean
}

/**
 * How long a feature takes to dock in this scene.
 *
 * @param config - The composition as the scene configured it.
 * @returns The slide's length.
 */
export function dockMsOf(config: ComposeConfig): number {
  return config.dockMs ?? DEFAULT_DOCK_MS
}

/**
 * When the last thing in the script has come to rest.
 *
 * @param config - The composition as the scene configured it.
 * @returns The offset at which nothing moves any more.
 * @example A scene whose last message leaves at nine seconds
 * ```ts
 * settledAt(config) // 9000 + FLIGHT_MS + GLOW_MS
 * ```
 */
export function settledAt(config: ComposeConfig): number {
  const dock = dockMsOf(config)
  let latest = 0
  for (const feature of config.features) {
    latest = max(latest, feature.dockAtMs + dock + WIRE_MS + FLASH_MS)
  }
  for (const message of config.messages) {
    latest = max(latest, message.atMs + FLIGHT_MS + GLOW_MS)
  }
  return latest
}

/**
 * The strongest glow a set of arrivals leaves at one end of a wire.
 *
 * @param messages - The messages that land at that end.
 * @param atMs - The moment being drawn.
 * @returns Glow intensity from 0 to 1.
 */
function glowAt(messages: readonly ComposeMessage[], atMs: number): number {
  return messages.reduce((strongest, message) => max(strongest, pulse(atMs, message.atMs + FLIGHT_MS, GLOW_MS)), 0)
}

/**
 * Work out where everything stands at one instant.
 *
 * Nothing is remembered between frames: every feature's position, every
 * wire's length and every dot in flight is read out of the script and the
 * moment asked for, which is what lets the same scene record identically
 * anywhere.
 *
 * @param config - The composition as the scene configured it.
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
export function composeStateAt(config: ComposeConfig, atMs: number): ComposeState {
  const dock = dockMsOf(config)
  const features = config.features.map((feature, index): FeatureState => {
    const seatedAt = feature.dockAtMs + dock
    return {
      seat: easeInOut(progress(atMs, feature.dockAtMs, dock)),
      flash: pulse(atMs, seatedAt, FLASH_MS),
      wire: easeOut(progress(atMs, seatedAt, WIRE_MS)),
      glow: glowAt(
        config.messages.filter((message) => message.feature === index && message.direction === 'to-feature'),
        atMs
      ),
    }
  })
  const dots = config.messages
    .filter((message) => atMs >= message.atMs && atMs < message.atMs + FLIGHT_MS)
    .map((message): DotState => ({ message, t: easeInOut(progress(atMs, message.atMs, FLIGHT_MS)) }))
  return {
    features,
    dots,
    hubGlow: glowAt(
      config.messages.filter((message) => message.direction === 'to-host'),
      atMs
    ),
    hubLive: features.some((feature) => feature.wire >= 1),
  }
}

/**
 * Where this koi's hover identity card sits, and how that reaches CSS.
 *
 * Kept out of the components because the card is positioned from a ref rather
 * than from props: it parks itself here the moment React mounts it, and moves
 * itself here on every frame the host's pointer stays on the fish.
 */
import type { PondEnvironment, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { KoiState } from './koi-motion'

/** How far ahead of the nose the card sits, as a fraction of body length. */
const CARD_AHEAD = 0.12

/** How far above the nose the card sits, as a fraction of body length. */
const CARD_ABOVE = 0.38

/** How close to the visible window's edge the card may park, in CSS pixels. */
const CARD_MARGIN = 8

/** The footprint the clamp keeps inside the visible window. */
export interface CardSize {
  /** The card's width, in CSS pixels. */
  width: number
  /** The card's height, in CSS pixels. */
  height: number
}

/**
 * Reads where the card belongs for a given frame, clamped into the window.
 *
 * @param state - What the koi is doing right now.
 * @param pond - The world as the host most recently announced it.
 * @param size - The card's measured footprint.
 * @returns The card's position, in frame pixels.
 */
export function cardAnchor(state: KoiState, pond: PondEnvironment, size: CardSize): Vec2 {
  const head = state.spine.joints[0] ?? state.position
  // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
  // why: The card rides off the koi's shoulder rather than its nose, so it never covers the fish a visitor is pointing at.
  const x = head.x - pond.view.x + state.length * CARD_AHEAD
  const y = head.y - pond.view.y - state.length * CARD_ABOVE
  // why: A tapped fish near a window edge must still show its whole card — on touch there is no hover to chase it with.
  return {
    x: Math.min(Math.max(x, CARD_MARGIN), Math.max(CARD_MARGIN, pond.view.width - size.width - CARD_MARGIN)),
    y: Math.min(Math.max(y, CARD_MARGIN), Math.max(CARD_MARGIN, pond.view.height - size.height - CARD_MARGIN)),
  }
}

/**
 * Formats a card position as the transform that parks it there.
 *
 * @param at - Where the card sits, in frame pixels.
 * @returns The CSS transform.
 *
 * @example Following a koi with its card
 * ```typescript
 * card.style.transform = cardTransform(cardAnchor(motion.state, pond, size))
 * ```
 */
export function cardTransform(at: Vec2): string {
  return `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`
}

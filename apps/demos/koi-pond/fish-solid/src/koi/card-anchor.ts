/**
 * Where this koi's identity card sits, and how that reaches CSS.
 *
 * Kept out of the components because the card is positioned from a ref rather
 * than from a signal: it parks itself here the moment a visitor holds the
 * fish, and moves itself here on every frame the hold lasts.
 */
import type { PondEnvironment, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { KoiState } from './koi-motion'

/** How far ahead of the nose the card sits, as a fraction of body length. */
const CARD_AHEAD = 0.12

/** How far above the nose the card sits, as a fraction of body length. */
const CARD_ABOVE = 0.38

/** The gap the card keeps from every edge of the visible window, in pixels. */
const CARD_MARGIN = 8

/**
 * Reads where the card belongs for a given frame, clamped into the visible window.
 *
 * @param state - What the koi is doing right now.
 * @param pond - The world as the host most recently announced it.
 * @param size - The card's rendered width and height, in pixels.
 * @returns The card's position, in frame pixels.
 */
export function cardAnchor(state: KoiState, pond: PondEnvironment, size: { width: number; height: number }): Vec2 {
  const head = state.spine.joints[0] ?? state.position
  // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
  // why: The card rides off the koi's shoulder rather than its nose, so it never covers the fish a visitor is pointing at.
  const x = head.x - pond.view.x + state.length * CARD_AHEAD
  const y = head.y - pond.view.y - state.length * CARD_ABOVE
  // why: A koi near a window edge must still show its whole card, so the anchor clamps to a small margin inside the view.
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
 * card.style.transform = cardTransform(cardAnchor(motion.state, pond, { width: 200, height: 64 }))
 * ```
 */
export function cardTransform(at: Vec2): string {
  return `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`
}

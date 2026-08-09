/**
 * Where this koi's hover identity card sits, and how that reaches CSS.
 *
 * Kept out of the components because the card is positioned from a ref rather
 * than from props: it parks itself here the moment the host says the pointer
 * arrived, and moves itself here on every frame the pointer stays on the fish.
 */
import type { PondWindow, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { KoiState } from './koi-motion'

/** How far ahead of the nose the card sits, as a fraction of body length. */
const CARD_AHEAD = 0.12

/** How far above the nose the card sits, as a fraction of body length. */
const CARD_ABOVE = 0.38

/**
 * Reads where the card belongs for a given frame.
 *
 * @param state - What the koi is doing right now.
 * @param view - The window of pond space the presenting frame shows.
 * @returns The card's position, in frame pixels.
 *
 * @example Following a koi with its card
 * ```typescript
 * card.style.transform = cardTransform(cardAnchor(motion.state, pond.view))
 * ```
 */
export function cardAnchor(state: KoiState, view: PondWindow): Vec2 {
  const head = state.spine.joints[0] ?? state.position
  // why: The card lives in the frame's own CSS space while the spine is in pond space, so the visible window's origin comes off first.
  // why: It rides off the koi's shoulder rather than its nose, so it never covers the fish a visitor is pointing at.
  return { x: head.x - view.x + state.length * CARD_AHEAD, y: head.y - view.y - state.length * CARD_ABOVE }
}

/**
 * Formats a card position as the transform that parks it there.
 *
 * @param at - Where the card sits, in frame pixels.
 * @returns The CSS transform.
 */
export function cardTransform(at: Vec2): string {
  return `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`
}

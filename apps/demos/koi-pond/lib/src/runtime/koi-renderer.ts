/**
 * The drawing seam a koi runtime drives.
 *
 * How a koi looks on screen is its app's own business, and this is the whole of
 * what the runtime asks of it: eight calls, none of which say anything about
 * canvases, components, or frameworks. One loop therefore drives renderers
 * written in as many idioms as there are apps rendering a koi, and a spec drives
 * a recording double of one with no GPU in sight.
 */
import type { KoiCardDetails } from '../model/card.js'
import type { KoiCardPanel, KoiProfile, PondEnvironment } from '../model/types.js'
import type { KoiState } from '../motion/koi-motion.js'

/** A renderer bound to one koi. */
export interface KoiRenderer {
  /**
   * Advances and redraws the koi from its current state.
   *
   * @param state - What the koi is doing right now.
   * @param dt - Seconds since the previous frame.
   */
  draw(state: KoiState, dt: number): void
  /**
   * Re-derives whatever the renderer sizes from a newly announced world.
   *
   * @param pond - The world as the host most recently announced it.
   */
  setPond(pond: PondEnvironment): void
  /**
   * Marks whether the host's pointer is over this koi.
   *
   * Hover only says "this is selectable": the identity card belongs to the hold.
   *
   * @param hovered - Whether the pointer is over this koi.
   */
  setHovered(hovered: boolean): void
  /**
   * Marks whether a visitor is holding this koi for inspection.
   *
   * An inspected koi traces its full silhouette and keeps its identity card open
   * until release, whatever the pointer does meanwhile.
   *
   * @param selected - Whether a visitor is inspecting this koi.
   */
  setSelected(selected: boolean): void
  /**
   * Rewrites the identity card's live inspector rows.
   *
   * @param details - The koi's live facts.
   */
  updateCard(details: KoiCardDetails): void
  /**
   * Positions the identity card beside the koi.
   *
   * @param state - What the koi is doing right now.
   */
  placeCard(state: KoiState): void
  /**
   * Where the identity card and its links currently sit, in pond space.
   *
   * A koi's frame is pointer-transparent, so nothing drawn inside it can be
   * clicked; reporting the card's geometry lets the host float real anchors over
   * the links and an inert shield over the rest.
   *
   * @returns The card's geometry, or `null` while the card is hidden.
   */
  cardRects(): KoiCardPanel | null
  /** Releases everything the renderer holds, its GPU resources included. */
  dispose(): void
}

/** How a runtime builds its renderer, replaceable so specs can run without a GPU. */
export type KoiRendererFactory = (root: HTMLElement, profile: KoiProfile, url: string, pond: PondEnvironment) => KoiRenderer

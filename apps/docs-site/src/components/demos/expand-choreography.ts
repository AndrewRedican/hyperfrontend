/**
 * How a surface hands its staged demo between the card and the expanded
 * overlay.
 *
 * Two demos can want opposite things from an expand. A demo whose worth is in
 * what it has accumulated (a rhythm it measured, a state the visitor built up)
 * wants the running session carried across: the card was a small window onto
 * it, and expanding only widens the window. A demo that sizes its whole world
 * to the frame it was mounted in wants the opposite, because the card world
 * stretched over a viewport is not the world it would have built there; the
 * honest expand is a different session, opened for the scene it opens into.
 *
 * The stage therefore carries a generation beside the scene. A surface mounts
 * its embed under that generation, so a demo that reopens is handed a genuinely
 * fresh session on every scene change while a demo that does not keeps the one
 * it has. Exactly one generation is mounted at a time, which is what keeps a
 * swap from ever leaving two sessions of one demo alive together: the
 * replacement is opened by the same mount that destroyed its predecessor, in
 * that order.
 *
 * A session hears which scene it was opened for on its own handshake, so
 * nothing here needs to tell a session being replaced anything at all.
 */
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** How a surface is presenting its staged demo. */
export type DemoScene = 'card' | 'full'

/** The session a surface holds on stage. */
export interface StagedSession {
  /** The scene the surface presents, and the scene the session is opened for. */
  scene: DemoScene
  /** Names the session; a different number is a different session. */
  generation: number
}

/** The session every surface starts from, and returns to when a demo takes the stage. */
export const CARD_SESSION: StagedSession = freeze<StagedSession>({ scene: 'card', generation: 0 })

/**
 * Stages a demo in a scene.
 *
 * @param current - The session on stage.
 * @param scene - The scene the surface is presenting.
 * @param reopens - `true` when this demo is opened afresh for each scene.
 * @returns The session the surface stages next.
 *
 * @example Expanding a demo that reopens for the overlay
 * ```typescript
 * const overlay = stageScene({ scene: 'card', generation: 0 }, 'full', true)
 * // { scene: 'full', generation: 1 }
 * ```
 */
export function stageScene(current: StagedSession, scene: DemoScene, reopens: boolean): StagedSession {
  if (scene === current.scene) {
    // why: Being told the scene it already holds is not a change, and a demo that reopens must never answer one by trading a live session for an identical one.
    return current
  }
  return { scene, generation: reopens ? current.generation + 1 : current.generation }
}

/**
 * Drops the overlay because another demo is taking the stage.
 *
 * @param current - The session on stage.
 * @returns The session the surface holds while the handover runs.
 *
 * @example Collapsing on the way to a neighbouring demo
 * ```typescript
 * const leaving = stageHandover({ scene: 'full', generation: 3 })
 * // { scene: 'card', generation: 3 }
 * ```
 */
export function stageHandover(current: StagedSession): StagedSession {
  // why: This session dies with the handover, so the overlay comes down without a replacement being opened for a stage the demo is in the act of losing.
  return stageScene(current, 'card', false)
}
